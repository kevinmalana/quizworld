-- QuizWorld production recovery bundle
-- TARGET PROJECT REF: tqmygnkwkjtkteguemya
-- Generated 2026-08-20 from reviewed repository migrations.
-- Paste this entire file into the Supabase SQL Editor for that exact project and click Run once.
-- The transaction rolls back all changes if any statement fails.

BEGIN;

-- ============================================================================
-- 20260820_presentation_security_recovery.sql
-- ============================================================================

-- Presentation runtime recovery and privacy boundary.
-- Apply separately before deploying the matching Phoenix/frontend release.

-- Repair environments where the original presentation migration was only
-- partially applied. Phoenix remains the only public write/read authority.
CREATE TABLE IF NOT EXISTS public.qna_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id UUID NOT NULL REFERENCES public.slides(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  participant_name TEXT DEFAULT 'Anonymous',
  question TEXT NOT NULL,
  upvotes INTEGER NOT NULL DEFAULT 0,
  answered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qna_questions_slide
  ON public.qna_questions(slide_id);

CREATE TABLE IF NOT EXISTS public.qna_question_upvotes (
  question_id UUID NOT NULL REFERENCES public.qna_questions(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, participant_id)
);

ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slide_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qna_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qna_question_upvotes ENABLE ROW LEVEL SECURITY;

-- Remove the original anonymous answer-key and participant-data exposure.
DROP POLICY IF EXISTS "Presentations public read live" ON public.presentations;
DROP POLICY IF EXISTS "Slides public read" ON public.slides;
DROP POLICY IF EXISTS "Responses insert" ON public.slide_responses;
DROP POLICY IF EXISTS "Responses read" ON public.slide_responses;
DROP POLICY IF EXISTS "QnA insert" ON public.qna_questions;
DROP POLICY IF EXISTS "QnA read" ON public.qna_questions;
DROP POLICY IF EXISTS "QnA update" ON public.qna_questions;
DROP POLICY IF EXISTS "QnA upvotes no anon" ON public.qna_question_upvotes;

-- Deck owners retain direct editor access. Audience access is through the
-- sanitized Phoenix snapshot/activity endpoints with issued session tokens.
DROP POLICY IF EXISTS "Slides creator CRUD" ON public.slides;
CREATE POLICY "Slides creator CRUD" ON public.slides
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.presentations p
      WHERE p.id = presentation_id AND p.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.presentations p
      WHERE p.id = presentation_id AND p.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Responses no direct client access" ON public.slide_responses;
CREATE POLICY "Responses no direct client access" ON public.slide_responses
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "QnA no direct client access" ON public.qna_questions;
CREATE POLICY "QnA no direct client access" ON public.qna_questions
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "QnA upvotes no direct client access" ON public.qna_question_upvotes;
CREATE POLICY "QnA upvotes no direct client access" ON public.qna_question_upvotes
  FOR ALL USING (false) WITH CHECK (false);

REVOKE SELECT ON TABLE public.presentations FROM anon;
REVOKE ALL ON TABLE public.slide_responses FROM anon, authenticated;
REVOKE ALL ON TABLE public.qna_questions FROM anon, authenticated;
REVOKE ALL ON TABLE public.qna_question_upvotes FROM anon, authenticated;


-- ============================================================================
-- 20260820_atomic_quiz_drafts.sql
-- ============================================================================

-- Save a quiz draft and all nested authoring data in one transaction.
-- Any failed question/answer write rolls back the metadata update and delete,
-- so an autosave error cannot leave a previously healthy draft empty/partial.

CREATE OR REPLACE FUNCTION public.save_quiz_draft(
  p_draft_id UUID,
  p_quiz_id UUID,
  p_title TEXT,
  p_category TEXT,
  p_emoji TEXT,
  p_color TEXT,
  p_is_public BOOLEAN,
  p_source_type TEXT,
  p_questions JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_draft_id UUID := p_draft_id;
  v_question_id UUID;
  v_question RECORD;
  v_answer RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF jsonb_typeof(p_questions) <> 'array' THEN
    RAISE EXCEPTION 'Draft questions must be an array.';
  END IF;

  IF p_quiz_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.quizzes
    WHERE id = p_quiz_id
      AND creator_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'A draft can only be linked to your own quiz.';
  END IF;

  IF v_draft_id IS NULL THEN
    INSERT INTO public.quiz_drafts (
      owner_id, quiz_id, title, category, emoji, color,
      is_public, source_type, updated_at
    )
    VALUES (
      v_user_id,
      p_quiz_id,
      COALESCE(p_title, ''),
      COALESCE(NULLIF(TRIM(p_category), ''), 'Trivia'),
      NULLIF(TRIM(COALESCE(p_emoji, '')), ''),
      NULLIF(TRIM(COALESCE(p_color, '')), ''),
      COALESCE(p_is_public, true),
      COALESCE(NULLIF(TRIM(p_source_type), ''), 'manual'),
      now()
    )
    RETURNING id INTO v_draft_id;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.quiz_drafts
      WHERE id = v_draft_id
        AND owner_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'Draft not found.';
    END IF;

    UPDATE public.quiz_drafts
    SET quiz_id = p_quiz_id,
        title = COALESCE(p_title, ''),
        category = COALESCE(NULLIF(TRIM(p_category), ''), 'Trivia'),
        emoji = NULLIF(TRIM(COALESCE(p_emoji, '')), ''),
        color = NULLIF(TRIM(COALESCE(p_color, '')), ''),
        is_public = COALESCE(p_is_public, true),
        source_type = COALESCE(NULLIF(TRIM(p_source_type), ''), 'manual'),
        updated_at = now()
    WHERE id = v_draft_id
      AND owner_id = v_user_id;
  END IF;

  DELETE FROM public.quiz_draft_questions
  WHERE draft_id = v_draft_id;

  FOR v_question IN
    SELECT value AS question, ordinality - 1 AS order_index
    FROM jsonb_array_elements(p_questions) WITH ORDINALITY
  LOOP
    IF jsonb_typeof(v_question.question->'answers') <> 'array' THEN
      RAISE EXCEPTION 'Draft question answers must be an array.';
    END IF;

    INSERT INTO public.quiz_draft_questions (
      draft_id, text, image_url, time_limit, points, order_index,
      question_type, explanation
    )
    VALUES (
      v_draft_id,
      COALESCE(v_question.question->>'text', ''),
      NULLIF(v_question.question->>'image_url', ''),
      GREATEST(COALESCE((v_question.question->>'time_limit')::INTEGER, 20), 1),
      GREATEST(COALESCE((v_question.question->>'points')::INTEGER, 1000), 0),
      v_question.order_index,
      COALESCE(NULLIF(TRIM(v_question.question->>'question_type'), ''), 'multiple_choice'),
      NULLIF(v_question.question->>'explanation', '')
    )
    RETURNING id INTO v_question_id;

    FOR v_answer IN
      SELECT value AS answer, ordinality - 1 AS order_index
      FROM jsonb_array_elements(v_question.question->'answers') WITH ORDINALITY
    LOOP
      INSERT INTO public.quiz_draft_answers (
        question_id, text, image_url, is_correct, order_index
      )
      VALUES (
        v_question_id,
        COALESCE(v_answer.answer->>'text', ''),
        NULLIF(v_answer.answer->>'image_url', ''),
        COALESCE((v_answer.answer->>'is_correct')::BOOLEAN, false),
        v_answer.order_index
      );
    END LOOP;
  END LOOP;

  RETURN v_draft_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_quiz_draft(UUID, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_quiz_draft(UUID, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, JSONB) TO authenticated;


-- ============================================================================
-- 20260820130000_social_notifications_and_catalog.sql
-- ============================================================================

-- Durable social notifications, verified assignment completion and canonical categories.
-- Additive/idempotent: safe to apply before the frontend that consumes it.

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('classroom_nudge')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  href TEXT NOT NULL,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.classroom_assignments(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_assignment
  ON public.notifications (assignment_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recipients read own notifications" ON public.notifications;
CREATE POLICY "Recipients read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Recipients mark own notifications read" ON public.notifications;
CREATE POLICY "Recipients mark own notifications read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Classroom teachers notify their students" ON public.notifications;
CREATE POLICY "Classroom teachers notify their students"
  ON public.notifications FOR INSERT
  WITH CHECK (
    auth.uid() = actor_id
    AND type = 'classroom_nudge'
    AND EXISTS (
      SELECT 1
      FROM public.classroom_members cm_teacher
      JOIN public.classroom_members cm_student
        ON cm_student.classroom_id = cm_teacher.classroom_id
      JOIN public.classroom_assignments ca
        ON ca.classroom_id = cm_teacher.classroom_id
      WHERE cm_teacher.classroom_id = notifications.classroom_id
        AND cm_teacher.user_id = auth.uid()
        AND cm_teacher.role = 'teacher'
        AND cm_student.user_id = notifications.user_id
        AND cm_student.role = 'student'
        AND ca.id = notifications.assignment_id
    )
  );

-- Existing manual completion remains available, but its provenance is explicit.
ALTER TABLE public.assignment_completions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'study_session'));

CREATE OR REPLACE FUNCTION public.complete_classroom_assignments_from_study()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.assignment_completions (assignment_id, user_id, source)
  SELECT ca.id, NEW.user_id, 'study_session'
  FROM public.classroom_assignments ca
  JOIN public.classroom_members cm
    ON cm.classroom_id = ca.classroom_id
   AND cm.user_id = NEW.user_id
   AND cm.role = 'student'
  WHERE ca.quiz_id = NEW.quiz_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.assignment_completions ac
      WHERE ac.assignment_id = ca.id
        AND ac.user_id = NEW.user_id
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS complete_classroom_assignments_from_study ON public.study_sessions;
CREATE TRIGGER complete_classroom_assignments_from_study
  AFTER INSERT ON public.study_sessions
  FOR EACH ROW
  WHEN (NEW.total_questions > 0)
  EXECUTE FUNCTION public.complete_classroom_assignments_from_study();

-- Collapse legacy aliases into the labels used by current discovery navigation.
UPDATE public.quizzes
SET category = CASE category
  WHEN 'Mathematics' THEN 'Math'
  WHEN 'Animals' THEN 'Animals & Pets'
  WHEN 'Art' THEN 'Art & Literature'
  WHEN 'Books' THEN 'Art & Literature'
  WHEN 'Vehicles' THEN 'Cars & Automotive'
  WHEN 'Comics' THEN 'Comics & Anime'
  WHEN 'Anime & Manga' THEN 'Comics & Anime'
  WHEN 'Cartoons' THEN 'Comics & Anime'
  WHEN 'Mythology' THEN 'Mythology & Folklore'
  WHEN 'Politics' THEN 'Politics & Government'
  WHEN 'Computers' THEN 'Technology'
  WHEN 'Gadgets & Tech' THEN 'Technology'
  WHEN 'Television' THEN 'TV Shows'
  ELSE category
END
WHERE category IN (
  'Mathematics', 'Animals', 'Art', 'Books', 'Vehicles', 'Comics',
  'Anime & Manga', 'Cartoons', 'Mythology', 'Politics', 'Computers',
  'Gadgets & Tech', 'Television'
);

COMMIT;

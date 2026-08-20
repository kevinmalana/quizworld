-- Additive compatibility phase for the 2026-08-20 recovery.
-- Apply before Phoenix and frontend. This migration never deletes activity rows.

-- Presentation runs are immutable occurrences, not one mutable row per deck.
ALTER TABLE public.presentation_live_sessions
  DROP CONSTRAINT IF EXISTS presentation_live_sessions_presentation_id_key;
ALTER TABLE public.presentation_live_sessions
  ADD COLUMN IF NOT EXISTS state JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE INDEX IF NOT EXISTS idx_presentation_live_sessions_presentation_started
  ON public.presentation_live_sessions (presentation_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_presentation_live_sessions_one_live
  ON public.presentation_live_sessions (presentation_id)
  WHERE status = 'live';

ALTER TABLE public.presentation_participants
  ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES public.presentation_live_sessions(id);
ALTER TABLE public.slide_responses
  ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES public.presentation_live_sessions(id);

CREATE TABLE IF NOT EXISTS public.qna_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES public.presentations(id) ON DELETE CASCADE,
  slide_id UUID NOT NULL REFERENCES public.slides(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.presentation_live_sessions(id),
  participant_id TEXT NOT NULL,
  participant_name TEXT NOT NULL DEFAULT 'Anonymous',
  question TEXT NOT NULL,
  upvotes INTEGER NOT NULL DEFAULT 0,
  answered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qna_question_upvotes (
  question_id UUID NOT NULL REFERENCES public.qna_questions(id) ON DELETE CASCADE,
  presentation_id UUID NOT NULL REFERENCES public.presentations(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  run_id UUID REFERENCES public.presentation_live_sessions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, participant_id)
);

ALTER TABLE public.qna_questions
  ADD COLUMN IF NOT EXISTS presentation_id UUID REFERENCES public.presentations(id) ON DELETE CASCADE;
ALTER TABLE public.qna_questions
  ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES public.presentation_live_sessions(id);
ALTER TABLE public.qna_question_upvotes
  ADD COLUMN IF NOT EXISTS presentation_id UUID REFERENCES public.presentations(id) ON DELETE CASCADE;
ALTER TABLE public.qna_question_upvotes
  ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES public.presentation_live_sessions(id);

UPDATE public.qna_questions qq
SET presentation_id = s.presentation_id
FROM public.slides s
WHERE qq.slide_id = s.id
  AND qq.presentation_id IS NULL;

UPDATE public.qna_question_upvotes qu
SET presentation_id = qq.presentation_id
FROM public.qna_questions qq
WHERE qu.question_id = qq.id
  AND qu.presentation_id IS NULL;

ALTER TABLE public.qna_questions ALTER COLUMN presentation_id SET NOT NULL;
ALTER TABLE public.qna_question_upvotes ALTER COLUMN presentation_id SET NOT NULL;

UPDATE public.presentation_participants pp
SET run_id = (
  SELECT pls.id
  FROM public.presentation_live_sessions pls
  WHERE pls.presentation_id = pp.presentation_id
  ORDER BY pls.started_at DESC, pls.id DESC
  LIMIT 1
)
WHERE pp.run_id IS NULL;

UPDATE public.slide_responses sr
SET run_id = run.id
FROM public.slides s
CROSS JOIN LATERAL (
  SELECT pls.id
  FROM public.presentation_live_sessions pls
  WHERE pls.presentation_id = s.presentation_id
  ORDER BY pls.started_at DESC, pls.id DESC
  LIMIT 1
) run
WHERE sr.slide_id = s.id
  AND sr.run_id IS NULL;

UPDATE public.qna_questions qq
SET run_id = run.id
FROM public.slides s
CROSS JOIN LATERAL (
  SELECT pls.id
  FROM public.presentation_live_sessions pls
  WHERE pls.presentation_id = s.presentation_id
  ORDER BY pls.started_at DESC, pls.id DESC
  LIMIT 1
) run
WHERE qq.slide_id = s.id
  AND qq.run_id IS NULL;

UPDATE public.qna_question_upvotes qu
SET run_id = qq.run_id
FROM public.qna_questions qq
WHERE qu.question_id = qq.id
  AND qu.run_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_presentation_participants_run
  ON public.presentation_participants (run_id, joined_at);
CREATE INDEX IF NOT EXISTS idx_slide_responses_run_slide
  ON public.slide_responses (run_id, slide_id, created_at);
CREATE INDEX IF NOT EXISTS idx_qna_questions_run_slide
  ON public.qna_questions (run_id, slide_id, created_at);
CREATE INDEX IF NOT EXISTS idx_qna_upvotes_run_question
  ON public.qna_question_upvotes (run_id, question_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_presentation_participant_run_id
  ON public.presentation_participants (run_id, id)
  WHERE run_id IS NOT NULL;

-- Durable notifications: clients can read their rows, while writes go through RPCs.
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

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (user_id, created_at DESC) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Recipients read own notifications" ON public.notifications;
CREATE POLICY "Recipients read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.notifications FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_classroom_nudges(
  p_classroom_id UUID,
  p_assignment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_count INTEGER;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.classroom_members cm_teacher
    JOIN public.classroom_assignments ca ON ca.classroom_id = cm_teacher.classroom_id
    WHERE cm_teacher.classroom_id = p_classroom_id
      AND cm_teacher.user_id = v_actor_id
      AND cm_teacher.role = 'teacher'
      AND ca.id = p_assignment_id
  ) THEN
    RAISE EXCEPTION 'Only the classroom teacher can send assignment nudges.';
  END IF;

  INSERT INTO public.notifications (
    user_id, actor_id, type, title, message, href, classroom_id, assignment_id
  )
  SELECT cm.user_id, v_actor_id, 'classroom_nudge', 'Assignment reminder',
    'You have a classroom assignment waiting.',
    '/classrooms/' || p_classroom_id::TEXT, p_classroom_id, p_assignment_id
  FROM public.classroom_members cm
  WHERE cm.classroom_id = p_classroom_id
    AND cm.role = 'student'
    AND NOT EXISTS (
      SELECT 1 FROM public.assignment_completions ac
      WHERE ac.assignment_id = p_assignment_id AND ac.user_id = cm.user_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('sent', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_notification_ids UUID[] DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  UPDATE public.notifications
  SET read_at = COALESCE(read_at, now())
  WHERE user_id = v_user_id
    AND (p_notification_ids IS NULL OR id = ANY(p_notification_ids));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('updated', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.send_classroom_nudges(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_notifications_read(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_classroom_nudges(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_classroom_nudges(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(UUID[]) TO service_role;

-- Verified study completion and assignment provenance.
ALTER TABLE public.assignment_completions ADD COLUMN IF NOT EXISTS source TEXT;
UPDATE public.assignment_completions SET source = 'manual' WHERE source IS NULL;
ALTER TABLE public.assignment_completions ALTER COLUMN source SET DEFAULT 'manual';
ALTER TABLE public.assignment_completions ALTER COLUMN source SET NOT NULL;
ALTER TABLE public.assignment_completions DROP CONSTRAINT IF EXISTS assignment_completions_source_check;
ALTER TABLE public.assignment_completions ADD CONSTRAINT assignment_completions_source_check
  CHECK (source IN ('manual', 'study_session')) NOT VALID;
ALTER TABLE public.assignment_completions VALIDATE CONSTRAINT assignment_completions_source_check;

DROP POLICY IF EXISTS "Users manage own completions" ON public.assignment_completions;
DROP POLICY IF EXISTS "Users read own completions" ON public.assignment_completions;
DROP POLICY IF EXISTS "Users insert manual completions" ON public.assignment_completions;
DROP POLICY IF EXISTS "Users update manual completions" ON public.assignment_completions;
DROP POLICY IF EXISTS "Users delete manual completions" ON public.assignment_completions;
CREATE POLICY "Users read own completions" ON public.assignment_completions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Teachers read classroom completions" ON public.assignment_completions;
CREATE POLICY "Teachers read classroom completions" ON public.assignment_completions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.classroom_assignments ca
      JOIN public.classroom_members cm
        ON cm.classroom_id = ca.classroom_id
      WHERE ca.id = assignment_completions.assignment_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'teacher'
    )
  );
CREATE POLICY "Users insert manual completions" ON public.assignment_completions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND source = 'manual');
CREATE POLICY "Users update manual completions" ON public.assignment_completions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id AND source = 'manual')
  WITH CHECK (auth.uid() = user_id AND source = 'manual');
CREATE POLICY "Users delete manual completions" ON public.assignment_completions
  FOR DELETE TO authenticated USING (auth.uid() = user_id AND source = 'manual');

DROP TRIGGER IF EXISTS complete_classroom_assignments_from_study ON public.study_sessions;
DROP FUNCTION IF EXISTS public.complete_classroom_assignments_from_study();
DROP FUNCTION IF EXISTS public.complete_study_session_atomic(UUID, UUID, TEXT, INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.complete_study_session_atomic(
  p_quiz_id UUID,
  p_study_mode TEXT,
  p_correct INTEGER,
  p_total INTEGER,
  p_duration_secs INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_question_count INTEGER;
  v_xp_per_correct INTEGER;
  v_xp INTEGER;
  v_session_id UUID;
  v_total_xp INTEGER;
  v_streak INTEGER;
  v_completion_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF p_study_mode NOT IN ('flashcard', 'quickfire') THEN RAISE EXCEPTION 'Invalid study mode.'; END IF;
  IF p_correct < 0 OR p_total <= 0 OR p_correct > p_total THEN RAISE EXCEPTION 'Invalid study totals.'; END IF;
  IF p_duration_secs IS NOT NULL AND p_duration_secs < 0 THEN RAISE EXCEPTION 'Invalid duration.'; END IF;

  SELECT COUNT(*) INTO v_question_count FROM public.questions WHERE quiz_id = p_quiz_id;
  IF v_question_count = 0 THEN RAISE EXCEPTION 'Quiz has no questions.'; END IF;
  IF p_total <> v_question_count THEN RAISE EXCEPTION 'Total does not match quiz question count.'; END IF;

  v_xp_per_correct := CASE p_study_mode WHEN 'quickfire' THEN 45 ELSE 25 END;
  v_xp := p_correct * v_xp_per_correct + 50 + CASE WHEN p_correct = p_total THEN 100 ELSE 0 END;

  INSERT INTO public.study_sessions (user_id, quiz_id, xp_earned, correct, total, study_mode, duration_secs)
  VALUES (v_user_id, p_quiz_id, v_xp, p_correct, p_total, p_study_mode, p_duration_secs)
  RETURNING id INTO v_session_id;

  INSERT INTO public.study_progress (user_id, quiz_id, questions_studied, correct, mastery, last_studied)
  VALUES (v_user_id, p_quiz_id, p_total, p_correct, ROUND(p_correct * 100.0 / p_total), now())
  ON CONFLICT (user_id, quiz_id) DO UPDATE SET
    questions_studied = public.study_progress.questions_studied + EXCLUDED.questions_studied,
    correct = public.study_progress.correct + EXCLUDED.correct,
    mastery = ROUND((public.study_progress.correct + EXCLUDED.correct) * 100.0 /
      (public.study_progress.questions_studied + EXCLUDED.questions_studied)),
    last_studied = EXCLUDED.last_studied;

  UPDATE public.profiles SET
    total_xp = COALESCE(total_xp, 0) + v_xp,
    study_streak = CASE
      WHEN last_study_date = CURRENT_DATE THEN study_streak
      WHEN last_study_date = CURRENT_DATE - 1 THEN COALESCE(study_streak, 0) + 1
      ELSE 1 END,
    longest_streak = GREATEST(COALESCE(longest_streak, 0), CASE
      WHEN last_study_date = CURRENT_DATE THEN study_streak
      WHEN last_study_date = CURRENT_DATE - 1 THEN COALESCE(study_streak, 0) + 1
      ELSE 1 END),
    last_study_date = CURRENT_DATE
  WHERE id = v_user_id
  RETURNING total_xp, study_streak INTO v_total_xp, v_streak;

  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found.'; END IF;

  INSERT INTO public.assignment_completions (assignment_id, user_id, source)
  SELECT ca.id, v_user_id, 'study_session'
  FROM public.classroom_assignments ca
  JOIN public.classroom_members cm ON cm.classroom_id = ca.classroom_id
  WHERE ca.quiz_id = p_quiz_id AND cm.user_id = v_user_id AND cm.role = 'student'
  ON CONFLICT (assignment_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_completion_count = ROW_COUNT;

  RETURN jsonb_build_object('session_id', v_session_id, 'xp_earned', v_xp,
    'total_xp', v_total_xp, 'study_streak', v_streak,
    'assignment_completions', v_completion_count);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_study_session_atomic(UUID, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_study_session_atomic(UUID, TEXT, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_study_session_atomic(UUID, TEXT, INTEGER, INTEGER, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.increment_xp(user_uuid UUID, xp_amount INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF auth.uid() IS DISTINCT FROM user_uuid THEN RAISE EXCEPTION 'Cannot update another user.'; END IF;
  IF xp_amount < 0 THEN RAISE EXCEPTION 'XP must be non-negative.'; END IF;
  UPDATE public.profiles SET total_xp = COALESCE(total_xp, 0) + xp_amount WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.update_study_streak(user_uuid UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF auth.uid() IS DISTINCT FROM user_uuid THEN RAISE EXCEPTION 'Cannot update another user.'; END IF;
  UPDATE public.profiles SET
    study_streak = CASE WHEN last_study_date = CURRENT_DATE THEN study_streak
      WHEN last_study_date = CURRENT_DATE - 1 THEN COALESCE(study_streak, 0) + 1 ELSE 1 END,
    longest_streak = GREATEST(COALESCE(longest_streak, 0), CASE
      WHEN last_study_date = CURRENT_DATE THEN study_streak
      WHEN last_study_date = CURRENT_DATE - 1 THEN COALESCE(study_streak, 0) + 1 ELSE 1 END),
    last_study_date = CURRENT_DATE
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.increment_xp(UUID, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_study_streak(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_xp(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_study_streak(UUID) TO authenticated;

-- Complete draft model and optimistic, lossless saves.
ALTER TABLE public.quiz_drafts ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.quiz_draft_questions ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.quiz_draft_questions ADD COLUMN IF NOT EXISTS shuffle_answers BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS shuffle_answers BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.answers ADD COLUMN IF NOT EXISTS order_index INTEGER;

WITH ranked_answers AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY id) - 1 AS ordinal
  FROM public.answers
  WHERE order_index IS NULL
)
UPDATE public.answers a
SET order_index = ranked_answers.ordinal
FROM ranked_answers
WHERE a.id = ranked_answers.id;

ALTER TABLE public.answers ALTER COLUMN order_index SET DEFAULT 0;
ALTER TABLE public.answers ALTER COLUMN order_index SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_answers_question_order
  ON public.answers (question_id, order_index);

CREATE OR REPLACE FUNCTION public.save_quiz_draft_v2(
  p_draft_id UUID, p_expected_revision BIGINT, p_quiz_id UUID, p_title TEXT,
  p_category TEXT, p_emoji TEXT, p_color TEXT, p_is_public BOOLEAN,
  p_source_type TEXT, p_questions JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid(); v_draft_id UUID := p_draft_id; v_revision BIGINT;
  v_question RECORD; v_answer RECORD; v_question_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF jsonb_typeof(p_questions) <> 'array' THEN RAISE EXCEPTION 'Draft questions must be an array.'; END IF;
  IF p_quiz_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.quizzes WHERE id = p_quiz_id AND creator_id = v_user_id)
    THEN RAISE EXCEPTION 'A draft can only be linked to your own quiz.'; END IF;

  IF v_draft_id IS NULL THEN
    IF COALESCE(p_expected_revision, 0) <> 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'revision_conflict', 'revision', 0);
    END IF;
    INSERT INTO public.quiz_drafts (owner_id, quiz_id, title, category, emoji, color, is_public, source_type, revision, updated_at)
    VALUES (v_user_id, p_quiz_id, COALESCE(p_title, ''), COALESCE(NULLIF(TRIM(p_category), ''), 'Trivia'),
      NULLIF(TRIM(COALESCE(p_emoji, '')), ''), NULLIF(TRIM(COALESCE(p_color, '')), ''),
      COALESCE(p_is_public, true), COALESCE(NULLIF(TRIM(p_source_type), ''), 'manual'), 1, now())
    RETURNING id, revision INTO v_draft_id, v_revision;
  ELSE
    UPDATE public.quiz_drafts SET quiz_id = p_quiz_id, title = COALESCE(p_title, ''),
      category = COALESCE(NULLIF(TRIM(p_category), ''), 'Trivia'), emoji = NULLIF(TRIM(COALESCE(p_emoji, '')), ''),
      color = NULLIF(TRIM(COALESCE(p_color, '')), ''), is_public = COALESCE(p_is_public, true),
      source_type = COALESCE(NULLIF(TRIM(p_source_type), ''), 'manual'), revision = revision + 1, updated_at = now()
    WHERE id = v_draft_id AND owner_id = v_user_id AND revision = p_expected_revision
    RETURNING revision INTO v_revision;
    IF NOT FOUND THEN
      IF NOT EXISTS (SELECT 1 FROM public.quiz_drafts WHERE id = v_draft_id AND owner_id = v_user_id)
        THEN RAISE EXCEPTION 'Draft not found.'; END IF;
      SELECT revision INTO v_revision FROM public.quiz_drafts WHERE id = v_draft_id;
      RETURN jsonb_build_object('ok', false, 'error', 'revision_conflict', 'draft_id', v_draft_id, 'revision', v_revision);
    END IF;
    DELETE FROM public.quiz_draft_questions WHERE draft_id = v_draft_id;
  END IF;

  FOR v_question IN SELECT value question, ordinality - 1 order_index FROM jsonb_array_elements(p_questions) WITH ORDINALITY LOOP
    IF jsonb_typeof(v_question.question->'answers') <> 'array' THEN RAISE EXCEPTION 'Draft question answers must be an array.'; END IF;
    INSERT INTO public.quiz_draft_questions (draft_id, text, image_url, video_url, time_limit, points, order_index, question_type, explanation, shuffle_answers)
    VALUES (v_draft_id, COALESCE(v_question.question->>'text', ''), NULLIF(v_question.question->>'image_url', ''),
      NULLIF(v_question.question->>'video_url', ''), GREATEST(COALESCE((v_question.question->>'time_limit')::INTEGER, 20), 1),
      GREATEST(COALESCE((v_question.question->>'points')::INTEGER, 1000), 0), v_question.order_index,
      COALESCE(NULLIF(TRIM(v_question.question->>'question_type'), ''), 'multiple_choice'),
      NULLIF(v_question.question->>'explanation', ''), COALESCE((v_question.question->>'shuffle_answers')::BOOLEAN, false))
    RETURNING id INTO v_question_id;
    FOR v_answer IN SELECT value answer, ordinality - 1 order_index FROM jsonb_array_elements(v_question.question->'answers') WITH ORDINALITY LOOP
      INSERT INTO public.quiz_draft_answers (question_id, text, image_url, is_correct, order_index)
      VALUES (v_question_id, COALESCE(v_answer.answer->>'text', ''), NULLIF(v_answer.answer->>'image_url', ''),
        COALESCE((v_answer.answer->>'is_correct')::BOOLEAN, false), v_answer.order_index);
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'draft_id', v_draft_id, 'revision', v_revision);
END;
$$;

REVOKE ALL ON FUNCTION public.save_quiz_draft_v2(UUID, BIGINT, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_quiz_draft_v2(UUID, BIGINT, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, JSONB) TO authenticated;

-- Authoritative local publish signatures, extended to round-trip all current fields.
CREATE OR REPLACE FUNCTION public.publish_quiz(p_title TEXT, p_category TEXT, p_emoji TEXT, p_color TEXT, p_is_public BOOLEAN, p_questions JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID := auth.uid(); v_quiz_id UUID; v_question_id UUID; v_question RECORD; v_answer RECORD; v_correct_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF TRIM(COALESCE(p_title, '')) = '' OR jsonb_typeof(p_questions) <> 'array' OR jsonb_array_length(p_questions) = 0 THEN RAISE EXCEPTION 'A title and questions are required.'; END IF;
  INSERT INTO public.quizzes (creator_id,title,category,emoji,color,is_public) VALUES (v_user_id,TRIM(p_title),COALESCE(NULLIF(TRIM(p_category),''),'Trivia'),NULLIF(TRIM(COALESCE(p_emoji,'')),''),NULLIF(TRIM(COALESCE(p_color,'')),''),COALESCE(p_is_public,true)) RETURNING id INTO v_quiz_id;
  FOR v_question IN SELECT value question, ordinality - 1 order_index FROM jsonb_array_elements(p_questions) WITH ORDINALITY LOOP
    SELECT COUNT(*) INTO v_correct_count FROM jsonb_array_elements(v_question.question->'answers') a WHERE COALESCE((a.value->>'is_correct')::BOOLEAN,false);
    IF TRIM(COALESCE(v_question.question->>'text','')) = ''
      OR jsonb_typeof(v_question.question->'answers') <> 'array'
      OR jsonb_array_length(v_question.question->'answers') < 2
      OR (COALESCE(NULLIF(v_question.question->>'question_type',''),'multiple_choice') = 'poll' AND v_correct_count <> 0)
      OR (COALESCE(NULLIF(v_question.question->>'question_type',''),'multiple_choice') <> 'poll' AND v_correct_count <> 1)
    THEN RAISE EXCEPTION 'Each question requires text, two answers, and valid correctness.'; END IF;
    INSERT INTO public.questions (quiz_id,text,image_url,video_url,time_limit,points,order_index,question_type,explanation,shuffle_answers)
    VALUES (v_quiz_id,TRIM(v_question.question->>'text'),NULLIF(v_question.question->>'image_url',''),NULLIF(v_question.question->>'video_url',''),GREATEST(COALESCE((v_question.question->>'time_limit')::INTEGER,20),1),GREATEST(COALESCE((v_question.question->>'points')::INTEGER,1000),0),v_question.order_index,COALESCE(NULLIF(v_question.question->>'question_type',''),'multiple_choice'),NULLIF(v_question.question->>'explanation',''),COALESCE((v_question.question->>'shuffle_answers')::BOOLEAN,false)) RETURNING id INTO v_question_id;
    FOR v_answer IN SELECT value answer, ordinality - 1 order_index FROM jsonb_array_elements(v_question.question->'answers') WITH ORDINALITY LOOP
      IF TRIM(COALESCE(v_answer.answer->>'text','')) = '' THEN RAISE EXCEPTION 'Answer text is required.'; END IF;
      INSERT INTO public.answers (question_id,text,image_url,is_correct,order_index) VALUES (v_question_id,TRIM(COALESCE(v_answer.answer->>'text','')),NULLIF(v_answer.answer->>'image_url',''),COALESCE((v_answer.answer->>'is_correct')::BOOLEAN,false),v_answer.order_index);
    END LOOP;
  END LOOP;
  INSERT INTO public.quiz_versions (quiz_id,creator_id,version_number,title,category,emoji,color,is_public,snapshot) VALUES (v_quiz_id,v_user_id,1,TRIM(p_title),COALESCE(NULLIF(TRIM(p_category),''),'Trivia'),NULLIF(TRIM(COALESCE(p_emoji,'')),''),NULLIF(TRIM(COALESCE(p_color,'')),''),COALESCE(p_is_public,true),jsonb_build_object('title',p_title,'category',p_category,'emoji',p_emoji,'color',p_color,'is_public',p_is_public,'questions',p_questions));
  RETURN v_quiz_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.republish_quiz(p_quiz_id UUID, p_title TEXT, p_category TEXT, p_emoji TEXT, p_color TEXT, p_is_public BOOLEAN, p_questions JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID := auth.uid(); v_question_id UUID; v_question RECORD; v_answer RECORD; v_correct_count INTEGER; v_next_version INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  PERFORM 1 FROM public.quizzes WHERE id = p_quiz_id AND creator_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'You can only republish your own quiz.'; END IF;
  SELECT COALESCE(MAX(version_number),0)+1 INTO v_next_version FROM public.quiz_versions WHERE quiz_id=p_quiz_id;
  IF TRIM(COALESCE(p_title,''))='' OR jsonb_typeof(p_questions)<>'array' OR jsonb_array_length(p_questions)=0 THEN RAISE EXCEPTION 'A title and questions are required.'; END IF;
  UPDATE public.quizzes SET title=TRIM(p_title),category=COALESCE(NULLIF(TRIM(p_category),''),'Trivia'),emoji=NULLIF(TRIM(COALESCE(p_emoji,'')),''),color=NULLIF(TRIM(COALESCE(p_color,'')),''),is_public=COALESCE(p_is_public,true) WHERE id=p_quiz_id;
  DELETE FROM public.questions WHERE quiz_id=p_quiz_id;
  FOR v_question IN SELECT value question, ordinality - 1 order_index FROM jsonb_array_elements(p_questions) WITH ORDINALITY LOOP
    SELECT COUNT(*) INTO v_correct_count FROM jsonb_array_elements(v_question.question->'answers') a WHERE COALESCE((a.value->>'is_correct')::BOOLEAN,false);
    IF TRIM(COALESCE(v_question.question->>'text',''))=''
      OR jsonb_typeof(v_question.question->'answers') <> 'array'
      OR jsonb_array_length(v_question.question->'answers') < 2
      OR (COALESCE(NULLIF(v_question.question->>'question_type',''),'multiple_choice') = 'poll' AND v_correct_count <> 0)
      OR (COALESCE(NULLIF(v_question.question->>'question_type',''),'multiple_choice') <> 'poll' AND v_correct_count <> 1)
    THEN RAISE EXCEPTION 'Each question requires text, two answers, and valid correctness.'; END IF;
    INSERT INTO public.questions (quiz_id,text,image_url,video_url,time_limit,points,order_index,question_type,explanation,shuffle_answers) VALUES (p_quiz_id,TRIM(v_question.question->>'text'),NULLIF(v_question.question->>'image_url',''),NULLIF(v_question.question->>'video_url',''),GREATEST(COALESCE((v_question.question->>'time_limit')::INTEGER,20),1),GREATEST(COALESCE((v_question.question->>'points')::INTEGER,1000),0),v_question.order_index,COALESCE(NULLIF(v_question.question->>'question_type',''),'multiple_choice'),NULLIF(v_question.question->>'explanation',''),COALESCE((v_question.question->>'shuffle_answers')::BOOLEAN,false)) RETURNING id INTO v_question_id;
    FOR v_answer IN SELECT value answer, ordinality - 1 order_index FROM jsonb_array_elements(v_question.question->'answers') WITH ORDINALITY LOOP
      IF TRIM(COALESCE(v_answer.answer->>'text','')) = '' THEN RAISE EXCEPTION 'Answer text is required.'; END IF;
      INSERT INTO public.answers (question_id,text,image_url,is_correct,order_index)
      VALUES (v_question_id,TRIM(COALESCE(v_answer.answer->>'text','')),NULLIF(v_answer.answer->>'image_url',''),COALESCE((v_answer.answer->>'is_correct')::BOOLEAN,false),v_answer.order_index);
    END LOOP;
  END LOOP;
  INSERT INTO public.quiz_versions (quiz_id,creator_id,version_number,title,category,emoji,color,is_public,snapshot) VALUES (p_quiz_id,v_user_id,v_next_version,TRIM(p_title),COALESCE(NULLIF(TRIM(p_category),''),'Trivia'),NULLIF(TRIM(COALESCE(p_emoji,'')),''),NULLIF(TRIM(COALESCE(p_color,'')),''),COALESCE(p_is_public,true),jsonb_build_object('title',p_title,'category',p_category,'emoji',p_emoji,'color',p_color,'is_public',p_is_public,'questions',p_questions));
  RETURN jsonb_build_object('quiz_id',p_quiz_id,'version_number',v_next_version);
END;
$$;

REVOKE ALL ON FUNCTION public.publish_quiz(TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.republish_quiz(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_quiz(TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.republish_quiz(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;

-- Durable multiplayer result writes remain backend-only and pin-idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS game_results_pin_key ON public.game_results (pin);
CREATE OR REPLACE FUNCTION public.record_game_result(
  p_pin TEXT, p_quiz_id UUID, p_host_id UUID, p_player_count INTEGER,
  p_results JSONB, p_finished_at TIMESTAMPTZ DEFAULT now()
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_existing_id UUID;
BEGIN
  SELECT id INTO v_existing_id FROM public.game_results WHERE pin = p_pin LIMIT 1;
  INSERT INTO public.game_results (pin, quiz_id, host_id, player_count, results, finished_at, updated_at)
  VALUES (p_pin, p_quiz_id, p_host_id, GREATEST(COALESCE(p_player_count, 0), 0),
    COALESCE(p_results, '{}'::JSONB), COALESCE(p_finished_at, now()), now())
  ON CONFLICT (pin) DO UPDATE SET quiz_id = EXCLUDED.quiz_id, host_id = EXCLUDED.host_id,
    player_count = EXCLUDED.player_count, results = EXCLUDED.results,
    finished_at = EXCLUDED.finished_at, updated_at = now();
  IF v_existing_id IS NULL THEN
    UPDATE public.quizzes SET plays = COALESCE(plays, 0) + 1 WHERE id = p_quiz_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.record_game_result(TEXT, UUID, UUID, INTEGER, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_game_result(TEXT, UUID, UUID, INTEGER, JSONB, TIMESTAMPTZ) TO service_role;

-- Explicit presentation privileges; service_role is the runtime storage adapter.
ALTER TABLE public.presentation_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slide_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qna_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qna_question_upvotes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.presentation_live_sessions, public.presentation_participants,
  public.slide_responses, public.qna_questions, public.qna_question_upvotes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.presentation_live_sessions, public.presentation_participants,
  public.slide_responses, public.qna_questions, public.qna_question_upvotes TO service_role;

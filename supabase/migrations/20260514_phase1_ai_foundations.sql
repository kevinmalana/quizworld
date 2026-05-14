-- ============================================================
-- QuizWorld Phase 1: AI Foundations Migration
-- Adds question_type and explanation columns
-- Run AFTER 20260506_image_questions.sql
-- ============================================================

-- ── 1. Add question_type and explanation to questions ────────

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'multiple_choice';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS explanation TEXT;

-- ── 2. Add to draft questions too ────────────────────────────

ALTER TABLE public.quiz_draft_questions ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'multiple_choice';
ALTER TABLE public.quiz_draft_questions ADD COLUMN IF NOT EXISTS explanation TEXT;

-- ── 3. Update publish_quiz RPC to save question_type and explanation ──

DROP FUNCTION IF EXISTS public.publish_quiz(TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB);

CREATE OR REPLACE FUNCTION public.publish_quiz(
  p_title TEXT,
  p_category TEXT,
  p_emoji TEXT,
  p_color TEXT,
  p_is_public BOOLEAN,
  p_questions JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_quiz_id UUID;
  v_question_id UUID;
  v_title TEXT := TRIM(COALESCE(p_title, ''));
  v_category TEXT := TRIM(COALESCE(p_category, ''));
  v_question RECORD;
  v_answer RECORD;
  v_correct_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF v_title = '' THEN RAISE EXCEPTION 'Add a title before publishing.'; END IF;
  IF v_category = '' THEN v_category := 'Trivia'; END IF;
  IF jsonb_typeof(p_questions) <> 'array' OR jsonb_array_length(p_questions) = 0 THEN
    RAISE EXCEPTION 'Add at least one complete question before publishing.';
  END IF;

  INSERT INTO public.quizzes (creator_id, title, category, emoji, color, is_public)
  VALUES (v_user_id, v_title, v_category, NULLIF(TRIM(COALESCE(p_emoji, '')), ''), NULLIF(TRIM(COALESCE(p_color, '')), ''), COALESCE(p_is_public, true))
  RETURNING id INTO v_quiz_id;

  FOR v_question IN
    SELECT value AS question, ordinality - 1 AS order_index
    FROM jsonb_array_elements(p_questions) WITH ORDINALITY
  LOOP
    IF TRIM(COALESCE(v_question.question->>'text', '')) = '' THEN
      RAISE EXCEPTION 'Complete all questions before publishing.';
    END IF;
    IF jsonb_typeof(v_question.question->'answers') <> 'array' OR jsonb_array_length(v_question.question->'answers') = 0 THEN
      RAISE EXCEPTION 'Each question must include answers.';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_question.question->'answers') AS answer(value) WHERE TRIM(COALESCE(answer.value->>'text', '')) = '') THEN
      RAISE EXCEPTION 'Complete all answer choices before publishing.';
    END IF;
    SELECT COUNT(*) INTO v_correct_count FROM jsonb_array_elements(v_question.question->'answers') AS answer(value) WHERE COALESCE((answer.value->>'is_correct')::BOOLEAN, false);
    IF v_correct_count <> 1 THEN
      RAISE EXCEPTION 'Each question must have exactly one correct answer.';
    END IF;

    INSERT INTO public.questions (quiz_id, text, image_url, time_limit, points, order_index, question_type, explanation)
    VALUES (
      v_quiz_id,
      TRIM(COALESCE(v_question.question->>'text', '')),
      NULLIF(TRIM(COALESCE(v_question.question->>'image_url', '')), ''),
      GREATEST(COALESCE((v_question.question->>'time_limit')::INTEGER, 20), 1),
      GREATEST(COALESCE((v_question.question->>'points')::INTEGER, 1000), 0),
      v_question.order_index,
      COALESCE(NULLIF(TRIM(v_question.question->>'question_type'), ''), 'multiple_choice'),
      NULLIF(TRIM(COALESCE(v_question.question->>'explanation', '')), '')
    )
    RETURNING id INTO v_question_id;

    FOR v_answer IN SELECT value AS answer FROM jsonb_array_elements(v_question.question->'answers')
    LOOP
      INSERT INTO public.answers (question_id, text, image_url, is_correct)
      VALUES (
        v_question_id,
        TRIM(COALESCE(v_answer.answer->>'text', '')),
        NULLIF(TRIM(COALESCE(v_answer.answer->>'image_url', '')), ''),
        COALESCE((v_answer.answer->>'is_correct')::BOOLEAN, false)
      );
    END LOOP;
  END LOOP;

  INSERT INTO public.quiz_versions (quiz_id, creator_id, version_number, title, category, emoji, color, is_public, snapshot)
  VALUES (v_quiz_id, v_user_id, 1, v_title, v_category, NULLIF(TRIM(COALESCE(p_emoji, '')), ''), NULLIF(TRIM(COALESCE(p_color, '')), ''), COALESCE(p_is_public, true),
    jsonb_build_object('title', v_title, 'category', v_category, 'emoji', NULLIF(TRIM(COALESCE(p_emoji, '')), ''), 'color', NULLIF(TRIM(COALESCE(p_color, '')), ''), 'is_public', COALESCE(p_is_public, true), 'questions', p_questions));

  RETURN v_quiz_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_quiz(TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;

-- ── 4. Update republish_quiz RPC ─────────────────────────────

DROP FUNCTION IF EXISTS public.republish_quiz(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB);

CREATE OR REPLACE FUNCTION public.republish_quiz(
  p_quiz_id UUID, p_title TEXT, p_category TEXT, p_emoji TEXT, p_color TEXT, p_is_public BOOLEAN, p_questions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_quiz_id UUID := p_quiz_id;
  v_question_id UUID;
  v_title TEXT := TRIM(COALESCE(p_title, ''));
  v_category TEXT := TRIM(COALESCE(p_category, ''));
  v_question RECORD;
  v_answer RECORD;
  v_correct_count INTEGER;
  v_next_version INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF v_quiz_id IS NULL THEN RAISE EXCEPTION 'Quiz is required.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quizzes WHERE id = v_quiz_id AND creator_id = v_user_id) THEN RAISE EXCEPTION 'You can only republish your own quiz.'; END IF;
  IF v_title = '' THEN RAISE EXCEPTION 'Add a title before publishing.'; END IF;
  IF v_category = '' THEN v_category := 'Trivia'; END IF;
  IF jsonb_typeof(p_questions) <> 'array' OR jsonb_array_length(p_questions) = 0 THEN RAISE EXCEPTION 'Add at least one complete question before publishing.'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.quiz_versions WHERE quiz_id = v_quiz_id) THEN
    INSERT INTO public.quiz_versions (quiz_id, creator_id, version_number, title, category, emoji, color, is_public, snapshot)
    SELECT q.id, q.creator_id, 1, q.title, q.category, q.emoji, q.color, q.is_public, jsonb_build_object('questions', '[]'::jsonb)
    FROM public.quizzes q WHERE q.id = v_quiz_id;
  END IF;

  UPDATE public.quizzes SET title = v_title, category = v_category, emoji = NULLIF(TRIM(COALESCE(p_emoji, '')), ''), color = NULLIF(TRIM(COALESCE(p_color, '')), ''), is_public = COALESCE(p_is_public, true)
  WHERE id = v_quiz_id AND creator_id = v_user_id;

  DELETE FROM public.questions WHERE quiz_id = v_quiz_id;

  FOR v_question IN SELECT value AS question, ordinality - 1 AS order_index FROM jsonb_array_elements(p_questions) WITH ORDINALITY
  LOOP
    IF TRIM(COALESCE(v_question.question->>'text', '')) = '' THEN RAISE EXCEPTION 'Complete all questions before publishing.'; END IF;
    IF jsonb_typeof(v_question.question->'answers') <> 'array' OR jsonb_array_length(v_question.question->'answers') = 0 THEN RAISE EXCEPTION 'Each question must include answers.'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_question.question->'answers') AS answer(value) WHERE TRIM(COALESCE(answer.value->>'text', '')) = '') THEN RAISE EXCEPTION 'Complete all answer choices before publishing.'; END IF;
    SELECT COUNT(*) INTO v_correct_count FROM jsonb_array_elements(v_question.question->'answers') AS answer(value) WHERE COALESCE((answer.value->>'is_correct')::BOOLEAN, false);
    IF v_correct_count <> 1 THEN RAISE EXCEPTION 'Each question must have exactly one correct answer.'; END IF;

    INSERT INTO public.questions (quiz_id, text, image_url, time_limit, points, order_index, question_type, explanation)
    VALUES (
      v_quiz_id,
      TRIM(COALESCE(v_question.question->>'text', '')),
      NULLIF(TRIM(COALESCE(v_question.question->>'image_url', '')), ''),
      GREATEST(COALESCE((v_question.question->>'time_limit')::INTEGER, 20), 1),
      GREATEST(COALESCE((v_question.question->>'points')::INTEGER, 1000), 0),
      v_question.order_index,
      COALESCE(NULLIF(TRIM(v_question.question->>'question_type'), ''), 'multiple_choice'),
      NULLIF(TRIM(COALESCE(v_question.question->>'explanation', '')), '')
    )
    RETURNING id INTO v_question_id;

    FOR v_answer IN SELECT value AS answer FROM jsonb_array_elements(v_question.question->'answers')
    LOOP
      INSERT INTO public.answers (question_id, text, image_url, is_correct)
      VALUES (
        v_question_id,
        TRIM(COALESCE(v_answer.answer->>'text', '')),
        NULLIF(TRIM(COALESCE(v_answer.answer->>'image_url', '')), ''),
        COALESCE((v_answer.answer->>'is_correct')::BOOLEAN, false)
      );
    END LOOP;
  END LOOP;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version FROM public.quiz_versions WHERE quiz_id = v_quiz_id;

  INSERT INTO public.quiz_versions (quiz_id, creator_id, version_number, title, category, emoji, color, is_public, snapshot)
  VALUES (v_quiz_id, v_user_id, v_next_version, v_title, v_category, NULLIF(TRIM(COALESCE(p_emoji, '')), ''), NULLIF(TRIM(COALESCE(p_color, '')), ''), COALESCE(p_is_public, true),
    jsonb_build_object('title', v_title, 'category', v_category, 'emoji', NULLIF(TRIM(COALESCE(p_emoji, '')), ''), 'color', NULLIF(TRIM(COALESCE(p_color, '')), ''), 'is_public', COALESCE(p_is_public, true), 'questions', p_questions));

  RETURN jsonb_build_object('quiz_id', v_quiz_id, 'version_number', v_next_version);
END;
$$;

GRANT EXECUTE ON FUNCTION public.republish_quiz(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;

-- ── Done ─────────────────────────────────────────────────────

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

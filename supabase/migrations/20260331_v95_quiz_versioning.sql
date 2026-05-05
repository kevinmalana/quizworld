CREATE TABLE IF NOT EXISTS public.quiz_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  emoji TEXT,
  color TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, version_number)
);

ALTER TABLE public.quiz_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Quiz versions read own" ON public.quiz_versions;
DROP POLICY IF EXISTS "Quiz versions insert own" ON public.quiz_versions;

CREATE POLICY "Quiz versions read own"
ON public.quiz_versions
FOR SELECT
USING (auth.uid() = creator_id);

CREATE POLICY "Quiz versions insert own"
ON public.quiz_versions
FOR INSERT
WITH CHECK (auth.uid() = creator_id);

DROP FUNCTION IF EXISTS public.republish_quiz(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB);
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
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF v_title = '' THEN
    RAISE EXCEPTION 'Add a title before publishing.';
  END IF;

  IF v_category = '' THEN
    v_category := 'Trivia';
  END IF;

  IF jsonb_typeof(p_questions) <> 'array' OR jsonb_array_length(p_questions) = 0 THEN
    RAISE EXCEPTION 'Add at least one complete question before publishing.';
  END IF;

  INSERT INTO public.quizzes (
    creator_id,
    title,
    category,
    emoji,
    color,
    is_public
  )
  VALUES (
    v_user_id,
    v_title,
    v_category,
    NULLIF(TRIM(COALESCE(p_emoji, '')), ''),
    NULLIF(TRIM(COALESCE(p_color, '')), ''),
    COALESCE(p_is_public, true)
  )
  RETURNING id INTO v_quiz_id;

  FOR v_question IN
    SELECT value AS question, ordinality - 1 AS order_index
    FROM jsonb_array_elements(p_questions) WITH ORDINALITY
  LOOP
    IF TRIM(COALESCE(v_question.question->>'text', '')) = '' THEN
      RAISE EXCEPTION 'Complete all questions before publishing.';
    END IF;

    IF jsonb_typeof(v_question.question->'answers') <> 'array'
      OR jsonb_array_length(v_question.question->'answers') = 0 THEN
      RAISE EXCEPTION 'Each question must include answers.';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_question.question->'answers') AS answer(value)
      WHERE TRIM(COALESCE(answer.value->>'text', '')) = ''
    ) THEN
      RAISE EXCEPTION 'Complete all answer choices before publishing.';
    END IF;

    SELECT COUNT(*)
    INTO v_correct_count
    FROM jsonb_array_elements(v_question.question->'answers') AS answer(value)
    WHERE COALESCE((answer.value->>'is_correct')::BOOLEAN, false);

    IF v_correct_count <> 1 THEN
      RAISE EXCEPTION 'Each question must have exactly one correct answer.';
    END IF;

    INSERT INTO public.questions (
      quiz_id,
      text,
      time_limit,
      points,
      order_index
    )
    VALUES (
      v_quiz_id,
      TRIM(COALESCE(v_question.question->>'text', '')),
      GREATEST(COALESCE((v_question.question->>'time_limit')::INTEGER, 20), 1),
      GREATEST(COALESCE((v_question.question->>'points')::INTEGER, 1000), 0),
      v_question.order_index
    )
    RETURNING id INTO v_question_id;

    FOR v_answer IN
      SELECT value AS answer
      FROM jsonb_array_elements(v_question.question->'answers')
    LOOP
      INSERT INTO public.answers (
        question_id,
        text,
        is_correct
      )
      VALUES (
        v_question_id,
        TRIM(COALESCE(v_answer.answer->>'text', '')),
        COALESCE((v_answer.answer->>'is_correct')::BOOLEAN, false)
      );
    END LOOP;
  END LOOP;

  INSERT INTO public.quiz_versions (
    quiz_id,
    creator_id,
    version_number,
    title,
    category,
    emoji,
    color,
    is_public,
    snapshot
  )
  VALUES (
    v_quiz_id,
    v_user_id,
    1,
    v_title,
    v_category,
    NULLIF(TRIM(COALESCE(p_emoji, '')), ''),
    NULLIF(TRIM(COALESCE(p_color, '')), ''),
    COALESCE(p_is_public, true),
    jsonb_build_object(
      'title', v_title,
      'category', v_category,
      'emoji', NULLIF(TRIM(COALESCE(p_emoji, '')), ''),
      'color', NULLIF(TRIM(COALESCE(p_color, '')), ''),
      'is_public', COALESCE(p_is_public, true),
      'questions', p_questions
    )
  );

  RETURN v_quiz_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.republish_quiz(
  p_quiz_id UUID,
  p_title TEXT,
  p_category TEXT,
  p_emoji TEXT,
  p_color TEXT,
  p_is_public BOOLEAN,
  p_questions JSONB
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
  v_previous_snapshot JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF v_quiz_id IS NULL THEN
    RAISE EXCEPTION 'Quiz is required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.quizzes
    WHERE id = v_quiz_id
      AND creator_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You can only republish your own quiz.';
  END IF;

  IF v_title = '' THEN
    RAISE EXCEPTION 'Add a title before publishing.';
  END IF;

  IF v_category = '' THEN
    v_category := 'Trivia';
  END IF;

  IF jsonb_typeof(p_questions) <> 'array' OR jsonb_array_length(p_questions) = 0 THEN
    RAISE EXCEPTION 'Add at least one complete question before publishing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.quiz_versions
    WHERE quiz_id = v_quiz_id
  ) THEN
    SELECT jsonb_build_object(
      'title', q.title,
      'category', q.category,
      'emoji', q.emoji,
      'color', q.color,
      'is_public', q.is_public,
      'questions',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'text', qu.text,
              'time_limit', qu.time_limit,
              'points', qu.points,
              'answers',
              COALESCE(
                (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'text', a.text,
                      'is_correct', a.is_correct
                    )
                    ORDER BY a.id
                  )
                  FROM public.answers a
                  WHERE a.question_id = qu.id
                ),
                '[]'::jsonb
              )
            )
            ORDER BY qu.order_index
          )
          FROM public.questions qu
          WHERE qu.quiz_id = q.id
        ),
        '[]'::jsonb
      )
    )
    INTO v_previous_snapshot
    FROM public.quizzes q
    WHERE q.id = v_quiz_id;

    INSERT INTO public.quiz_versions (
      quiz_id,
      creator_id,
      version_number,
      title,
      category,
      emoji,
      color,
      is_public,
      snapshot
    )
    SELECT
      q.id,
      q.creator_id,
      1,
      q.title,
      q.category,
      q.emoji,
      q.color,
      q.is_public,
      COALESCE(v_previous_snapshot, jsonb_build_object('questions', '[]'::jsonb))
    FROM public.quizzes q
    WHERE q.id = v_quiz_id;
  END IF;

  UPDATE public.quizzes
  SET title = v_title,
      category = v_category,
      emoji = NULLIF(TRIM(COALESCE(p_emoji, '')), ''),
      color = NULLIF(TRIM(COALESCE(p_color, '')), ''),
      is_public = COALESCE(p_is_public, true)
  WHERE id = v_quiz_id
    AND creator_id = v_user_id;

  DELETE FROM public.questions
  WHERE quiz_id = v_quiz_id;

  FOR v_question IN
    SELECT value AS question, ordinality - 1 AS order_index
    FROM jsonb_array_elements(p_questions) WITH ORDINALITY
  LOOP
    IF TRIM(COALESCE(v_question.question->>'text', '')) = '' THEN
      RAISE EXCEPTION 'Complete all questions before publishing.';
    END IF;

    IF jsonb_typeof(v_question.question->'answers') <> 'array'
      OR jsonb_array_length(v_question.question->'answers') = 0 THEN
      RAISE EXCEPTION 'Each question must include answers.';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_question.question->'answers') AS answer(value)
      WHERE TRIM(COALESCE(answer.value->>'text', '')) = ''
    ) THEN
      RAISE EXCEPTION 'Complete all answer choices before publishing.';
    END IF;

    SELECT COUNT(*)
    INTO v_correct_count
    FROM jsonb_array_elements(v_question.question->'answers') AS answer(value)
    WHERE COALESCE((answer.value->>'is_correct')::BOOLEAN, false);

    IF v_correct_count <> 1 THEN
      RAISE EXCEPTION 'Each question must have exactly one correct answer.';
    END IF;

    INSERT INTO public.questions (
      quiz_id,
      text,
      time_limit,
      points,
      order_index
    )
    VALUES (
      v_quiz_id,
      TRIM(COALESCE(v_question.question->>'text', '')),
      GREATEST(COALESCE((v_question.question->>'time_limit')::INTEGER, 20), 1),
      GREATEST(COALESCE((v_question.question->>'points')::INTEGER, 1000), 0),
      v_question.order_index
    )
    RETURNING id INTO v_question_id;

    FOR v_answer IN
      SELECT value AS answer
      FROM jsonb_array_elements(v_question.question->'answers')
    LOOP
      INSERT INTO public.answers (
        question_id,
        text,
        is_correct
      )
      VALUES (
        v_question_id,
        TRIM(COALESCE(v_answer.answer->>'text', '')),
        COALESCE((v_answer.answer->>'is_correct')::BOOLEAN, false)
      );
    END LOOP;
  END LOOP;

  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_next_version
  FROM public.quiz_versions
  WHERE quiz_id = v_quiz_id;

  INSERT INTO public.quiz_versions (
    quiz_id,
    creator_id,
    version_number,
    title,
    category,
    emoji,
    color,
    is_public,
    snapshot
  )
  VALUES (
    v_quiz_id,
    v_user_id,
    v_next_version,
    v_title,
    v_category,
    NULLIF(TRIM(COALESCE(p_emoji, '')), ''),
    NULLIF(TRIM(COALESCE(p_color, '')), ''),
    COALESCE(p_is_public, true),
    jsonb_build_object(
      'title', v_title,
      'category', v_category,
      'emoji', NULLIF(TRIM(COALESCE(p_emoji, '')), ''),
      'color', NULLIF(TRIM(COALESCE(p_color, '')), ''),
      'is_public', COALESCE(p_is_public, true),
      'questions', p_questions
    )
  );

  RETURN jsonb_build_object(
    'quiz_id', v_quiz_id,
    'version_number', v_next_version
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_quiz(TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.republish_quiz(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;

-- v96: Enforce valid categories at the DB + RPC layer
-- Prevents any future quiz from being stored with an unrecognised category.

-- ── 1. Define canonical categories ─────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'quiz_category'
  ) THEN
    CREATE TYPE public.quiz_category AS ENUM (
      'Art & Literature',
      'Entertainment',
      'General Knowledge',
      'Geography',
      'History',
      'Languages',
      'Science & Nature',
      'Sports',
      'Trivia'
    );
  ELSE
    -- Add any missing values to existing enum
    BEGIN ALTER TYPE public.quiz_category ADD VALUE IF NOT EXISTS 'General Knowledge'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE public.quiz_category ADD VALUE IF NOT EXISTS 'Art & Literature';  EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE public.quiz_category ADD VALUE IF NOT EXISTS 'Entertainment';     EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE public.quiz_category ADD VALUE IF NOT EXISTS 'Geography';         EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE public.quiz_category ADD VALUE IF NOT EXISTS 'History';           EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE public.quiz_category ADD VALUE IF NOT EXISTS 'Languages';         EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE public.quiz_category ADD VALUE IF NOT EXISTS 'Science & Nature';  EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE public.quiz_category ADD VALUE IF NOT EXISTS 'Sports';            EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE public.quiz_category ADD VALUE IF NOT EXISTS 'Trivia';            EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END$$;

-- ── 2. Helper: normalise any category string to a valid value ──────────────
CREATE OR REPLACE FUNCTION public.normalise_category(p_cat TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_valid TEXT[] := ARRAY[
    'Art & Literature','Entertainment','General Knowledge',
    'Geography','History','Languages','Science & Nature','Sports','Trivia'
  ];
  v_cat TEXT := TRIM(COALESCE(p_cat, ''));
BEGIN
  -- Exact match (case-insensitive)
  SELECT val INTO v_cat
  FROM unnest(v_valid) AS val
  WHERE lower(val) = lower(v_cat)
  LIMIT 1;

  RETURN COALESCE(v_cat, 'Trivia');
END;
$$;

-- ── 3. Patch quizzes table: normalise any existing bad-category rows ───────
UPDATE public.quizzes
SET category = public.normalise_category(category)
WHERE category IS NULL
   OR category NOT IN (
    'Art & Literature','Entertainment','General Knowledge',
    'Geography','History','Languages','Science & Nature','Sports','Trivia'
   );

-- ── 4. Add CHECK constraint so the DB rejects bad values going forward ─────
ALTER TABLE public.quizzes
  DROP CONSTRAINT IF EXISTS quizzes_category_check;

ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_category_check
  CHECK (category IN (
    'Art & Literature','Entertainment','General Knowledge',
    'Geography','History','Languages','Science & Nature','Sports','Trivia'
  ));

-- ── 5. Update publish_quiz RPC to normalise category ──────────────────────
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
  v_category TEXT := public.normalise_category(p_category);
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

  IF jsonb_typeof(p_questions) <> 'array' OR jsonb_array_length(p_questions) = 0 THEN
    RAISE EXCEPTION 'Add at least one complete question before publishing.';
  END IF;

  INSERT INTO public.quizzes (creator_id, title, category, emoji, color, is_public)
  VALUES (
    v_user_id, v_title, v_category,
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
      SELECT 1 FROM jsonb_array_elements(v_question.question->'answers') AS answer(value)
      WHERE TRIM(COALESCE(answer.value->>'text', '')) = ''
    ) THEN
      RAISE EXCEPTION 'Complete all answer choices before publishing.';
    END IF;

    SELECT COUNT(*) INTO v_correct_count
    FROM jsonb_array_elements(v_question.question->'answers') AS answer(value)
    WHERE (answer.value->>'is_correct')::boolean = true;

    IF v_correct_count = 0 THEN
      RAISE EXCEPTION 'Each question must have at least one correct answer.';
    END IF;

    INSERT INTO public.questions (quiz_id, text, time_limit, points, order_index)
    VALUES (
      v_quiz_id,
      TRIM(v_question.question->>'text'),
      COALESCE((v_question.question->>'time_limit')::int, 20),
      COALESCE((v_question.question->>'points')::int, 1000),
      v_question.order_index
    )
    RETURNING id INTO v_question_id;

    FOR v_answer IN
      SELECT value AS answer FROM jsonb_array_elements(v_question.question->'answers')
    LOOP
      INSERT INTO public.answers (question_id, text, is_correct)
      VALUES (
        v_question_id,
        TRIM(v_answer.answer->>'text'),
        COALESCE((v_answer.answer->>'is_correct')::boolean, false)
      );
    END LOOP;
  END LOOP;

  RETURN v_quiz_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_quiz(TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalise_category(TEXT) TO authenticated;


-- ── 6. Update republish_quiz RPC to normalise category ────────────────────
-- (Only updating the category normalisation line; full function preserved)
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
  v_category TEXT := public.normalise_category(p_category);
  v_question RECORD;
  v_answer RECORD;
  v_correct_count INTEGER;
  v_next_version INTEGER;
  v_previous_snapshot JSONB;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF v_quiz_id IS NULL THEN RAISE EXCEPTION 'Quiz is required.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.quizzes WHERE id = v_quiz_id AND creator_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You can only republish your own quiz.';
  END IF;

  IF v_title = '' THEN RAISE EXCEPTION 'Add a title before publishing.'; END IF;

  IF jsonb_typeof(p_questions) <> 'array' OR jsonb_array_length(p_questions) = 0 THEN
    RAISE EXCEPTION 'Add at least one complete question before publishing.';
  END IF;

  -- Snapshot current version before overwrite
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM public.quiz_versions WHERE quiz_id = v_quiz_id;

  SELECT jsonb_build_object(
    'title', q.title, 'category', q.category, 'emoji', q.emoji,
    'color', q.color, 'is_public', q.is_public,
    'questions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'text', qu.text, 'time_limit', qu.time_limit, 'points', qu.points,
        'answers', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('text', a.text, 'is_correct', a.is_correct))
          FROM public.answers a WHERE a.question_id = qu.id
        ), '[]'::jsonb)
      ) ORDER BY qu.order_index)
      FROM public.questions qu WHERE qu.quiz_id = q.id
    ), '[]'::jsonb)
  ) INTO v_previous_snapshot FROM public.quizzes q WHERE q.id = v_quiz_id;

  INSERT INTO public.quiz_versions (quiz_id, creator_id, version_number, title, category, emoji, color, is_public, snapshot)
  VALUES (v_quiz_id, v_user_id, v_next_version, v_title, v_category,
          NULLIF(TRIM(COALESCE(p_emoji,'')), ''), NULLIF(TRIM(COALESCE(p_color,'')), ''),
          COALESCE(p_is_public, true), v_previous_snapshot);

  -- Replace questions + answers
  DELETE FROM public.answers WHERE question_id IN (
    SELECT id FROM public.questions WHERE quiz_id = v_quiz_id
  );
  DELETE FROM public.questions WHERE quiz_id = v_quiz_id;

  FOR v_question IN
    SELECT value AS question, ordinality - 1 AS order_index
    FROM jsonb_array_elements(p_questions) WITH ORDINALITY
  LOOP
    IF TRIM(COALESCE(v_question.question->>'text', '')) = '' THEN
      RAISE EXCEPTION 'Complete all questions before publishing.';
    END IF;

    SELECT COUNT(*) INTO v_correct_count
    FROM jsonb_array_elements(v_question.question->'answers') AS answer(value)
    WHERE (answer.value->>'is_correct')::boolean = true;

    IF v_correct_count = 0 THEN
      RAISE EXCEPTION 'Each question must have at least one correct answer.';
    END IF;

    INSERT INTO public.questions (quiz_id, text, time_limit, points, order_index)
    VALUES (
      v_quiz_id, TRIM(v_question.question->>'text'),
      COALESCE((v_question.question->>'time_limit')::int, 20),
      COALESCE((v_question.question->>'points')::int, 1000),
      v_question.order_index
    ) RETURNING id INTO v_question_id;

    FOR v_answer IN
      SELECT value AS answer FROM jsonb_array_elements(v_question.question->'answers')
    LOOP
      INSERT INTO public.answers (question_id, text, is_correct)
      VALUES (v_question_id, TRIM(v_answer.answer->>'text'),
              COALESCE((v_answer.answer->>'is_correct')::boolean, false));
    END LOOP;
  END LOOP;

  UPDATE public.quizzes
  SET title = v_title, category = v_category,
      emoji = NULLIF(TRIM(COALESCE(p_emoji,'')), ''),
      color = NULLIF(TRIM(COALESCE(p_color,'')), ''),
      is_public = COALESCE(p_is_public, true),
      updated_at = NOW()
  WHERE id = v_quiz_id;

  RETURN jsonb_build_object('quiz_id', v_quiz_id, 'version_number', v_next_version);
END;
$$;

GRANT EXECUTE ON FUNCTION public.republish_quiz(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;

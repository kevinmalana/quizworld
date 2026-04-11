-- QuizWorld v8.4 canonical Supabase bootstrap
-- Use this file for a fresh project.
-- For an existing v8 project, apply the current release delta:
-- supabase/migrations/20260327_v84_server_rpcs.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  emoji TEXT,
  color TEXT,
  plays INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  time_limit INTEGER NOT NULL DEFAULT 20,
  points INTEGER NOT NULL DEFAULT 1000,
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false
);

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

CREATE TABLE IF NOT EXISTS public.quiz_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Trivia',
  emoji TEXT,
  color TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  source_type TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_draft_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.quiz_drafts(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  time_limit INTEGER NOT NULL DEFAULT 20,
  points INTEGER NOT NULL DEFAULT 1000,
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS public.quiz_draft_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.quiz_draft_questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  is_correct BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin TEXT NOT NULL UNIQUE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  host_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'reveal', 'finished')),
  current_question_index INTEGER NOT NULL DEFAULT -1,
  game_mode TEXT NOT NULL DEFAULT 'classic',
  question_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  avatar TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.player_sessions (
  player_id UUID PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  access_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (access_token)
);

CREATE TABLE IF NOT EXISTS public.player_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_id UUID REFERENCES public.answers(id) ON DELETE CASCADE,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  response_time_ms INTEGER NOT NULL DEFAULT 0,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.study_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  questions_studied INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  mastery INTEGER NOT NULL DEFAULT 0,
  last_studied TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, quiz_id)
);

CREATE TABLE IF NOT EXISTS public.game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin TEXT NOT NULL UNIQUE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  host_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player_count INTEGER NOT NULL DEFAULT 0,
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_draft_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_draft_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.player_sessions FROM anon, authenticated;

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users read own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Quizzes read public or own" ON public.quizzes;
DROP POLICY IF EXISTS "Quizzes insert own" ON public.quizzes;
DROP POLICY IF EXISTS "Quizzes update own" ON public.quizzes;
DROP POLICY IF EXISTS "Quizzes delete own" ON public.quizzes;

CREATE POLICY "Quizzes read public or own"
ON public.quizzes
FOR SELECT
USING (is_public = true OR auth.uid() = creator_id);

CREATE POLICY "Quizzes insert own"
ON public.quizzes
FOR INSERT
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Quizzes update own"
ON public.quizzes
FOR UPDATE
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Quizzes delete own"
ON public.quizzes
FOR DELETE
USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Questions read" ON public.questions;
DROP POLICY IF EXISTS "Questions insert for owned quizzes" ON public.questions;
DROP POLICY IF EXISTS "Questions update for owned quizzes" ON public.questions;
DROP POLICY IF EXISTS "Questions delete for owned quizzes" ON public.questions;

CREATE POLICY "Questions read public or own"
ON public.questions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.quizzes q
    WHERE q.id = quiz_id
      AND (q.is_public = true OR q.creator_id = auth.uid())
  )
);

CREATE POLICY "Questions insert for owned quizzes"
ON public.questions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quizzes q
    WHERE q.id = quiz_id AND q.creator_id = auth.uid()
  )
);

CREATE POLICY "Questions update for owned quizzes"
ON public.questions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.quizzes q
    WHERE q.id = quiz_id AND q.creator_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quizzes q
    WHERE q.id = quiz_id AND q.creator_id = auth.uid()
  )
);

CREATE POLICY "Questions delete for owned quizzes"
ON public.questions
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.quizzes q
    WHERE q.id = quiz_id AND q.creator_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Answers read" ON public.answers;
DROP POLICY IF EXISTS "Answers insert for owned quizzes" ON public.answers;
DROP POLICY IF EXISTS "Answers update for owned quizzes" ON public.answers;
DROP POLICY IF EXISTS "Answers delete for owned quizzes" ON public.answers;
DROP POLICY IF EXISTS "Quiz drafts read own" ON public.quiz_drafts;
DROP POLICY IF EXISTS "Quiz drafts insert own" ON public.quiz_drafts;
DROP POLICY IF EXISTS "Quiz drafts update own" ON public.quiz_drafts;
DROP POLICY IF EXISTS "Quiz drafts delete own" ON public.quiz_drafts;
DROP POLICY IF EXISTS "Quiz versions read own" ON public.quiz_versions;
DROP POLICY IF EXISTS "Quiz versions insert own" ON public.quiz_versions;
DROP POLICY IF EXISTS "Quiz draft questions read own" ON public.quiz_draft_questions;
DROP POLICY IF EXISTS "Quiz draft questions insert own" ON public.quiz_draft_questions;
DROP POLICY IF EXISTS "Quiz draft questions update own" ON public.quiz_draft_questions;
DROP POLICY IF EXISTS "Quiz draft questions delete own" ON public.quiz_draft_questions;
DROP POLICY IF EXISTS "Quiz draft answers read own" ON public.quiz_draft_answers;
DROP POLICY IF EXISTS "Quiz draft answers insert own" ON public.quiz_draft_answers;
DROP POLICY IF EXISTS "Quiz draft answers update own" ON public.quiz_draft_answers;
DROP POLICY IF EXISTS "Quiz draft answers delete own" ON public.quiz_draft_answers;

CREATE POLICY "Answers read public or own"
ON public.answers
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.questions qu
    JOIN public.quizzes q ON q.id = qu.quiz_id
    WHERE qu.id = question_id
      AND (q.is_public = true OR q.creator_id = auth.uid())
  )
);

CREATE POLICY "Answers insert for owned quizzes"
ON public.answers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.questions qu
    JOIN public.quizzes q ON q.id = qu.quiz_id
    WHERE qu.id = question_id AND q.creator_id = auth.uid()
  )
);

CREATE POLICY "Answers update for owned quizzes"
ON public.answers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.questions qu
    JOIN public.quizzes q ON q.id = qu.quiz_id
    WHERE qu.id = question_id AND q.creator_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.questions qu
    JOIN public.quizzes q ON q.id = qu.quiz_id
    WHERE qu.id = question_id AND q.creator_id = auth.uid()
  )
);

CREATE POLICY "Answers delete for owned quizzes"
ON public.answers
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.questions qu
    JOIN public.quizzes q ON q.id = qu.quiz_id
    WHERE qu.id = question_id AND q.creator_id = auth.uid()
  )
);

CREATE POLICY "Quiz versions read own"
ON public.quiz_versions
FOR SELECT
USING (auth.uid() = creator_id);

CREATE POLICY "Quiz versions insert own"
ON public.quiz_versions
FOR INSERT
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Quiz drafts read own"
ON public.quiz_drafts
FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Quiz drafts insert own"
ON public.quiz_drafts
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Quiz drafts update own"
ON public.quiz_drafts
FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Quiz drafts delete own"
ON public.quiz_drafts
FOR DELETE
USING (auth.uid() = owner_id);

CREATE POLICY "Quiz draft questions read own"
ON public.quiz_draft_questions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.quiz_drafts d
    WHERE d.id = draft_id
      AND d.owner_id = auth.uid()
  )
);

CREATE POLICY "Quiz draft questions insert own"
ON public.quiz_draft_questions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quiz_drafts d
    WHERE d.id = draft_id
      AND d.owner_id = auth.uid()
  )
);

CREATE POLICY "Quiz draft questions update own"
ON public.quiz_draft_questions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.quiz_drafts d
    WHERE d.id = draft_id
      AND d.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quiz_drafts d
    WHERE d.id = draft_id
      AND d.owner_id = auth.uid()
  )
);

CREATE POLICY "Quiz draft questions delete own"
ON public.quiz_draft_questions
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.quiz_drafts d
    WHERE d.id = draft_id
      AND d.owner_id = auth.uid()
  )
);

CREATE POLICY "Quiz draft answers read own"
ON public.quiz_draft_answers
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.quiz_draft_questions dq
    JOIN public.quiz_drafts d ON d.id = dq.draft_id
    WHERE dq.id = question_id
      AND d.owner_id = auth.uid()
  )
);

CREATE POLICY "Quiz draft answers insert own"
ON public.quiz_draft_answers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quiz_draft_questions dq
    JOIN public.quiz_drafts d ON d.id = dq.draft_id
    WHERE dq.id = question_id
      AND d.owner_id = auth.uid()
  )
);

CREATE POLICY "Quiz draft answers update own"
ON public.quiz_draft_answers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.quiz_draft_questions dq
    JOIN public.quiz_drafts d ON d.id = dq.draft_id
    WHERE dq.id = question_id
      AND d.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quiz_draft_questions dq
    JOIN public.quiz_drafts d ON d.id = dq.draft_id
    WHERE dq.id = question_id
      AND d.owner_id = auth.uid()
  )
);

CREATE POLICY "Quiz draft answers delete own"
ON public.quiz_draft_answers
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.quiz_draft_questions dq
    JOIN public.quiz_drafts d ON d.id = dq.draft_id
    WHERE dq.id = question_id
      AND d.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Game sessions read" ON public.game_sessions;
DROP POLICY IF EXISTS "Game sessions insert by host" ON public.game_sessions;
DROP POLICY IF EXISTS "Game sessions update by host" ON public.game_sessions;
DROP POLICY IF EXISTS "Game sessions delete by host" ON public.game_sessions;
DROP POLICY IF EXISTS "Public insert game_sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Public update game_sessions" ON public.game_sessions;

CREATE POLICY "Game sessions read by host"
ON public.game_sessions
FOR SELECT
USING (auth.uid() = host_id);

CREATE POLICY "Game sessions insert by host"
ON public.game_sessions
FOR INSERT
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Game sessions delete by host"
ON public.game_sessions
FOR DELETE
USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "Players read" ON public.players;
DROP POLICY IF EXISTS "Players join waiting sessions" ON public.players;
DROP POLICY IF EXISTS "Players update by host" ON public.players;
DROP POLICY IF EXISTS "Players delete by host" ON public.players;
DROP POLICY IF EXISTS "Public update players" ON public.players;

CREATE POLICY "Players read by host"
ON public.players
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.game_sessions gs
    WHERE gs.id = session_id AND gs.host_id = auth.uid()
  )
);

CREATE POLICY "Players delete by host"
ON public.players
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.game_sessions gs
    WHERE gs.id = session_id AND gs.host_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Player answers read" ON public.player_answers;
DROP POLICY IF EXISTS "Player answers insert during active game" ON public.player_answers;
DROP POLICY IF EXISTS "Player answers update by host" ON public.player_answers;
DROP POLICY IF EXISTS "Public update player_answers" ON public.player_answers;

CREATE POLICY "Player answers read by host"
ON public.player_answers
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.players p
    JOIN public.game_sessions gs ON gs.id = p.session_id
    WHERE p.id = player_id
      AND p.session_id = session_id
      AND gs.host_id = auth.uid()
  )
);

DROP FUNCTION IF EXISTS public.publish_quiz(TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS public.republish_quiz(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB);

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

DROP FUNCTION IF EXISTS public.join_game_session(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.join_game_session(
  p_pin TEXT,
  p_nickname TEXT,
  p_avatar TEXT DEFAULT NULL
)
RETURNS TABLE(player_id UUID, player_token UUID, session_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_player_id UUID;
  v_player_token UUID;
  v_nickname TEXT;
  v_avatar TEXT;
BEGIN
  v_nickname := LEFT(TRIM(COALESCE(p_nickname, '')), 20);
  IF v_nickname = '' THEN
    RAISE EXCEPTION 'Nickname is required.';
  END IF;

  SELECT id
  INTO v_session_id
  FROM public.game_sessions
  WHERE pin = UPPER(TRIM(COALESCE(p_pin, '')))
    AND status = 'waiting'
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Game is not accepting new players.';
  END IF;

  v_avatar := NULLIF(TRIM(COALESCE(p_avatar, '')), '');

  INSERT INTO public.players (session_id, nickname, avatar)
  VALUES (v_session_id, v_nickname, v_avatar)
  RETURNING id INTO v_player_id;

  INSERT INTO public.player_sessions (player_id, session_id)
  VALUES (v_player_id, v_session_id)
  RETURNING access_token INTO v_player_token;

  RETURN QUERY
  SELECT v_player_id, v_player_token, v_session_id;
END;
$$;

DROP FUNCTION IF EXISTS public.submit_player_answer(UUID, UUID, UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.submit_player_answer(
  p_player_id UUID,
  p_player_token UUID,
  p_answer_id UUID,
  p_response_time_ms INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_status TEXT;
  v_question_id UUID;
  v_question_started_at TIMESTAMPTZ;
  v_time_limit INTEGER;
  v_answer_row_id UUID;
BEGIN
  SELECT
    gs.id,
    gs.status,
    q.id,
    gs.question_started_at,
    q.time_limit
  INTO
    v_session_id,
    v_status,
    v_question_id,
    v_question_started_at,
    v_time_limit
  FROM public.player_sessions ps
  JOIN public.players p
    ON p.id = ps.player_id
   AND p.session_id = ps.session_id
  JOIN public.game_sessions gs
    ON gs.id = ps.session_id
  LEFT JOIN public.questions q
    ON q.quiz_id = gs.quiz_id
   AND q.order_index = gs.current_question_index
  WHERE ps.player_id = p_player_id
    AND ps.access_token = p_player_token
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Player session is invalid.';
  END IF;

  IF v_status <> 'active' OR v_question_id IS NULL OR v_question_started_at IS NULL THEN
    RAISE EXCEPTION 'Answer window has closed.';
  END IF;

  IF now() > v_question_started_at + make_interval(secs => GREATEST(COALESCE(v_time_limit, 20), 1)) THEN
    RAISE EXCEPTION 'Answer window has closed.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.answers
    WHERE id = p_answer_id
      AND question_id = v_question_id
  ) THEN
    RAISE EXCEPTION 'Answer does not belong to the current question.';
  END IF;

  INSERT INTO public.player_answers (
    session_id,
    player_id,
    question_id,
    answer_id,
    response_time_ms
  )
  VALUES (
    v_session_id,
    p_player_id,
    v_question_id,
    p_answer_id,
    GREATEST(
      0,
      LEAST(
        COALESCE(p_response_time_ms, 0),
        GREATEST(COALESCE(v_time_limit, 20), 1) * 1000
      )
    )
  )
  ON CONFLICT (player_id, question_id) DO NOTHING
  RETURNING id INTO v_answer_row_id;

  IF v_answer_row_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Your answer is already locked in.';
  END IF;

  RETURN v_answer_row_id;
END;
$$;

DROP FUNCTION IF EXISTS public.start_game_session(UUID);

CREATE OR REPLACE FUNCTION public.start_game_session(p_session_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id UUID;
  v_status TEXT;
  v_quiz_id UUID;
  v_question_count INTEGER;
  v_player_count INTEGER;
BEGIN
  SELECT host_id, status, quiz_id
  INTO v_host_id, v_status, v_quiz_id
  FROM public.game_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game session not found.';
  END IF;

  IF auth.uid() IS DISTINCT FROM v_host_id THEN
    RAISE EXCEPTION 'Only the host can start the game.';
  END IF;

  IF v_status <> 'waiting' THEN
    RETURN v_status;
  END IF;

  SELECT COUNT(*) INTO v_question_count
  FROM public.questions
  WHERE quiz_id = v_quiz_id;

  IF v_question_count = 0 THEN
    RAISE EXCEPTION 'This quiz has no questions.';
  END IF;

  SELECT COUNT(*) INTO v_player_count
  FROM public.players
  WHERE session_id = p_session_id;

  IF v_player_count = 0 THEN
    RAISE EXCEPTION 'At least one player must join before starting.';
  END IF;

  UPDATE public.game_sessions
  SET status = 'active',
      current_question_index = 0,
      question_started_at = now()
  WHERE id = p_session_id;

  RETURN 'active';
END;
$$;

DROP FUNCTION IF EXISTS public.reveal_current_question(UUID);

CREATE OR REPLACE FUNCTION public.reveal_current_question(p_session_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id UUID;
  v_status TEXT;
  v_quiz_id UUID;
  v_question_index INTEGER;
  v_question_id UUID;
  v_question_points INTEGER;
  v_time_limit INTEGER;
  v_total_time_ms NUMERIC;
BEGIN
  SELECT host_id, status, quiz_id, current_question_index
  INTO v_host_id, v_status, v_quiz_id, v_question_index
  FROM public.game_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game session not found.';
  END IF;

  IF auth.uid() IS DISTINCT FROM v_host_id THEN
    RAISE EXCEPTION 'Only the host can reveal answers.';
  END IF;

  IF v_status = 'reveal' OR v_status = 'finished' THEN
    RETURN v_status;
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Game is not active.';
  END IF;

  SELECT id, points, time_limit
  INTO v_question_id, v_question_points, v_time_limit
  FROM public.questions
  WHERE quiz_id = v_quiz_id
    AND order_index = v_question_index
  LIMIT 1;

  IF v_question_id IS NULL THEN
    RAISE EXCEPTION 'Current question not found.';
  END IF;

  v_total_time_ms := GREATEST(COALESCE(v_time_limit, 20), 1) * 1000.0;

  UPDATE public.player_answers pa
  SET is_correct = a.is_correct,
      points_awarded = CASE
        WHEN a.is_correct THEN ROUND(
          v_question_points * (
            0.5 + 0.5 * GREATEST(
              0,
              1 - (COALESCE(pa.response_time_ms, 0)::NUMERIC / v_total_time_ms)
            )
          )
        )::INTEGER
        ELSE 0
      END
  FROM public.answers a
  WHERE pa.session_id = p_session_id
    AND pa.question_id = v_question_id
    AND pa.answer_id = a.id;

  UPDATE public.players p
  SET score = totals.total_points
  FROM (
    SELECT
      player.id AS player_id,
      COALESCE(SUM(pa.points_awarded), 0)::INTEGER AS total_points
    FROM public.players player
    LEFT JOIN public.player_answers pa
      ON pa.player_id = player.id
    WHERE player.session_id = p_session_id
    GROUP BY player.id
  ) AS totals
  WHERE p.id = totals.player_id;

  UPDATE public.game_sessions
  SET status = 'reveal'
  WHERE id = p_session_id;

  RETURN 'reveal';
END;
$$;

DROP FUNCTION IF EXISTS public.advance_game_session(UUID);

CREATE OR REPLACE FUNCTION public.advance_game_session(p_session_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id UUID;
  v_status TEXT;
  v_quiz_id UUID;
  v_question_index INTEGER;
  v_last_question_index INTEGER;
BEGIN
  SELECT host_id, status, quiz_id, current_question_index
  INTO v_host_id, v_status, v_quiz_id, v_question_index
  FROM public.game_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game session not found.';
  END IF;

  IF auth.uid() IS DISTINCT FROM v_host_id THEN
    RAISE EXCEPTION 'Only the host can advance the game.';
  END IF;

  IF v_status = 'finished' THEN
    RETURN 'finished';
  END IF;

  IF v_status <> 'reveal' THEN
    RAISE EXCEPTION 'Reveal the current question before advancing.';
  END IF;

  SELECT COALESCE(MAX(order_index), -1)
  INTO v_last_question_index
  FROM public.questions
  WHERE quiz_id = v_quiz_id;

  IF v_last_question_index < 0 THEN
    RAISE EXCEPTION 'This quiz has no questions.';
  END IF;

  IF v_question_index >= v_last_question_index THEN
    UPDATE public.game_sessions
    SET status = 'finished',
        question_started_at = NULL
    WHERE id = p_session_id;

    UPDATE public.quizzes
    SET plays = COALESCE(plays, 0) + 1
    WHERE id = v_quiz_id;

    RETURN 'finished';
  END IF;

  UPDATE public.game_sessions
  SET status = 'active',
      current_question_index = v_question_index + 1,
      question_started_at = now()
  WHERE id = p_session_id;

  RETURN 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_game_session(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_player_answer(UUID, UUID, UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_quiz(TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.republish_quiz(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_game_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reveal_current_question(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_game_session(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users read own study progress" ON public.study_progress;
DROP POLICY IF EXISTS "Users insert own study progress" ON public.study_progress;
DROP POLICY IF EXISTS "Users update own study progress" ON public.study_progress;

CREATE POLICY "Users read own study progress"
ON public.study_progress
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own study progress"
ON public.study_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own study progress"
ON public.study_progress
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Game results read own host results" ON public.game_results;

CREATE POLICY "Game results read own host results"
ON public.game_results
FOR SELECT
USING (auth.uid() = host_id);

DROP TRIGGER IF EXISTS increment_quiz_plays_on_session_start ON public.game_sessions;
DROP FUNCTION IF EXISTS public.increment_quiz_plays_on_session_start();

DROP FUNCTION IF EXISTS public.record_game_result(TEXT, UUID, UUID, INTEGER, JSONB, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.record_game_result(
  p_pin TEXT,
  p_quiz_id UUID,
  p_host_id UUID,
  p_player_count INTEGER,
  p_results JSONB,
  p_finished_at TIMESTAMPTZ DEFAULT now()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  SELECT id
  INTO v_existing_id
  FROM public.game_results
  WHERE pin = p_pin
  LIMIT 1;

  INSERT INTO public.game_results (
    pin,
    quiz_id,
    host_id,
    player_count,
    results,
    finished_at,
    updated_at
  )
  VALUES (
    p_pin,
    p_quiz_id,
    p_host_id,
    GREATEST(COALESCE(p_player_count, 0), 0),
    COALESCE(p_results, '{}'::jsonb),
    COALESCE(p_finished_at, now()),
    now()
  )
  ON CONFLICT (pin) DO UPDATE
  SET quiz_id = EXCLUDED.quiz_id,
      host_id = EXCLUDED.host_id,
      player_count = EXCLUDED.player_count,
      results = EXCLUDED.results,
      finished_at = EXCLUDED.finished_at,
      updated_at = now();

  IF v_existing_id IS NULL THEN
    UPDATE public.quizzes
    SET plays = COALESCE(plays, 0) + 1
    WHERE id = p_quiz_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_game_result(TEXT, UUID, UUID, INTEGER, JSONB, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_game_result(TEXT, UUID, UUID, INTEGER, JSONB, TIMESTAMPTZ) TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'game_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'player_answers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.player_answers;
  END IF;
END $$;

-- ─── Study Sessions (XP + session tracking) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  study_mode TEXT NOT NULL DEFAULT 'flashcard', -- 'flashcard' | 'quickfire'
  duration_secs INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own study sessions"
ON public.study_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own study sessions"
ON public.study_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ─── Profiles: add gamification columns ───────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS study_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_study_date DATE;

CREATE OR REPLACE FUNCTION update_study_streak(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
  last_date DATE;
  new_streak INTEGER;
BEGIN
  SELECT last_study_date INTO last_date FROM profiles WHERE id = user_uuid;

  IF last_date IS NULL THEN
    new_streak := 1;
  ELSIF last_date = CURRENT_DATE THEN
    -- same day, no change
    RETURN;
  ELSIF last_date = CURRENT_DATE - INTERVAL '1 day' THEN
    -- consecutive day
    new_streak := COALESCE((SELECT study_streak FROM profiles WHERE id = user_uuid), 0) + 1;
  ELSE
    -- streak broken
    new_streak := 1;
  END IF;

  UPDATE profiles
  SET
    study_streak = new_streak,
    longest_streak = GREATEST(longest_streak, new_streak),
    last_study_date = CURRENT_DATE
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_xp(user_uuid UUID, xp_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET total_xp = total_xp + xp_amount
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

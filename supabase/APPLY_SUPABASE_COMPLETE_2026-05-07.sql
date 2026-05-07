-- ============================================================
-- QuizWorld complete Supabase SQL bundle — 2026-05-07
-- Run in Supabase Dashboard → SQL Editor → New Query → Run
--
-- Includes:
-- 1. Base production schema/RLS/RPCs
-- 2. Image question columns + quiz-images storage bucket/policies
-- 3. Image-aware publish_quiz and republish_quiz RPC definitions
-- ============================================================

-- ============================================================
-- QuizWorld Production Migration
-- Paste this into Supabase Dashboard → SQL Editor → New Query
-- Then click "Run"
-- ============================================================

-- ── 1. Tables ────────────────────────────────────────────────

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

-- ── 2. RLS ───────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_draft_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_draft_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;

-- ── 3. RLS Policies (drop-if-exists + create) ────────────────

-- Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Quizzes
DROP POLICY IF EXISTS "Public quizzes readable" ON public.quizzes;
CREATE POLICY "Public quizzes readable" ON public.quizzes FOR SELECT USING (is_public = true AND archived_at IS NULL);

DROP POLICY IF EXISTS "Own quizzes readable" ON public.quizzes;
CREATE POLICY "Own quizzes readable" ON public.quizzes FOR SELECT USING (auth.uid() = creator_id);

-- Questions
DROP POLICY IF EXISTS "Questions read public or own" ON public.questions;
CREATE POLICY "Questions read public or own" ON public.questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND (q.is_public = true OR q.creator_id = auth.uid()))
);

-- Answers
DROP POLICY IF EXISTS "Answers read public or own" ON public.answers;
CREATE POLICY "Answers read public or own" ON public.answers FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.questions qu
    JOIN public.quizzes q ON q.id = qu.quiz_id
    WHERE qu.id = question_id AND (q.is_public = true OR q.creator_id = auth.uid())
  )
);

-- Quiz versions
DROP POLICY IF EXISTS "Quiz versions read own" ON public.quiz_versions;
CREATE POLICY "Quiz versions read own" ON public.quiz_versions FOR SELECT USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Quiz versions insert own" ON public.quiz_versions;
CREATE POLICY "Quiz versions insert own" ON public.quiz_versions FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Quiz drafts
DROP POLICY IF EXISTS "Quiz drafts read own" ON public.quiz_drafts;
CREATE POLICY "Quiz drafts read own" ON public.quiz_drafts FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Quiz drafts insert own" ON public.quiz_drafts;
CREATE POLICY "Quiz drafts insert own" ON public.quiz_drafts FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Quiz drafts update own" ON public.quiz_drafts;
CREATE POLICY "Quiz drafts update own" ON public.quiz_drafts FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Quiz drafts delete own" ON public.quiz_drafts;
CREATE POLICY "Quiz drafts delete own" ON public.quiz_drafts FOR DELETE USING (auth.uid() = owner_id);

-- Quiz draft questions
DROP POLICY IF EXISTS "Quiz draft questions read own" ON public.quiz_draft_questions;
CREATE POLICY "Quiz draft questions read own" ON public.quiz_draft_questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.quiz_drafts d WHERE d.id = draft_id AND d.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Quiz draft questions insert own" ON public.quiz_draft_questions;
CREATE POLICY "Quiz draft questions insert own" ON public.quiz_draft_questions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.quiz_drafts d WHERE d.id = draft_id AND d.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Quiz draft questions update own" ON public.quiz_draft_questions;
CREATE POLICY "Quiz draft questions update own" ON public.quiz_draft_questions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.quiz_drafts d WHERE d.id = draft_id AND d.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.quiz_drafts d WHERE d.id = draft_id AND d.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Quiz draft questions delete own" ON public.quiz_draft_questions;
CREATE POLICY "Quiz draft questions delete own" ON public.quiz_draft_questions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.quiz_drafts d WHERE d.id = draft_id AND d.owner_id = auth.uid())
);

-- Quiz draft answers
DROP POLICY IF EXISTS "Quiz draft answers read own" ON public.quiz_draft_answers;
CREATE POLICY "Quiz draft answers read own" ON public.quiz_draft_answers FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.quiz_draft_questions dq JOIN public.quiz_drafts d ON d.id = dq.draft_id WHERE dq.id = question_id AND d.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Quiz draft answers insert own" ON public.quiz_draft_answers;
CREATE POLICY "Quiz draft answers insert own" ON public.quiz_draft_answers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.quiz_draft_questions dq JOIN public.quiz_drafts d ON d.id = dq.draft_id WHERE dq.id = question_id AND d.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Quiz draft answers update own" ON public.quiz_draft_answers;
CREATE POLICY "Quiz draft answers update own" ON public.quiz_draft_answers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.quiz_draft_questions dq JOIN public.quiz_drafts d ON d.id = dq.draft_id WHERE dq.id = question_id AND d.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.quiz_draft_questions dq JOIN public.quiz_drafts d ON d.id = dq.draft_id WHERE dq.id = question_id AND d.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Quiz draft answers delete own" ON public.quiz_draft_answers;
CREATE POLICY "Quiz draft answers delete own" ON public.quiz_draft_answers FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.quiz_draft_questions dq JOIN public.quiz_drafts d ON d.id = dq.draft_id WHERE dq.id = question_id AND d.owner_id = auth.uid())
);

-- Game sessions
DROP POLICY IF EXISTS "Game sessions read by host" ON public.game_sessions;
CREATE POLICY "Game sessions read by host" ON public.game_sessions FOR SELECT USING (auth.uid() = host_id);

-- Game results
DROP POLICY IF EXISTS "Game results read own host results" ON public.game_results;
CREATE POLICY "Game results read own host results" ON public.game_results FOR SELECT USING (auth.uid() = host_id);

-- ── 4. RPC Functions ─────────────────────────────────────────

-- publish_quiz
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

    INSERT INTO public.questions (quiz_id, text, time_limit, points, order_index)
    VALUES (v_quiz_id, TRIM(COALESCE(v_question.question->>'text', '')), GREATEST(COALESCE((v_question.question->>'time_limit')::INTEGER, 20), 1), GREATEST(COALESCE((v_question.question->>'points')::INTEGER, 1000), 0), v_question.order_index)
    RETURNING id INTO v_question_id;

    FOR v_answer IN SELECT value AS answer FROM jsonb_array_elements(v_question.question->'answers')
    LOOP
      INSERT INTO public.answers (question_id, text, is_correct)
      VALUES (v_question_id, TRIM(COALESCE(v_answer.answer->>'text', '')), COALESCE((v_answer.answer->>'is_correct')::BOOLEAN, false));
    END LOOP;
  END LOOP;

  INSERT INTO public.quiz_versions (quiz_id, creator_id, version_number, title, category, emoji, color, is_public, snapshot)
  VALUES (v_quiz_id, v_user_id, 1, v_title, v_category, NULLIF(TRIM(COALESCE(p_emoji, '')), ''), NULLIF(TRIM(COALESCE(p_color, '')), ''), COALESCE(p_is_public, true),
    jsonb_build_object('title', v_title, 'category', v_category, 'emoji', NULLIF(TRIM(COALESCE(p_emoji, '')), ''), 'color', NULLIF(TRIM(COALESCE(p_color, '')), ''), 'is_public', COALESCE(p_is_public, true), 'questions', p_questions));

  RETURN v_quiz_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_quiz(TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;

-- republish_quiz
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
  v_previous_snapshot JSONB;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF v_quiz_id IS NULL THEN RAISE EXCEPTION 'Quiz is required.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quizzes WHERE id = v_quiz_id AND creator_id = v_user_id) THEN RAISE EXCEPTION 'You can only republish your own quiz.'; END IF;
  IF v_title = '' THEN RAISE EXCEPTION 'Add a title before publishing.'; END IF;
  IF v_category = '' THEN v_category := 'Trivia'; END IF;
  IF jsonb_typeof(p_questions) <> 'array' OR jsonb_array_length(p_questions) = 0 THEN RAISE EXCEPTION 'Add at least one complete question before publishing.'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.quiz_versions WHERE quiz_id = v_quiz_id) THEN
    SELECT jsonb_build_object('title', q.title, 'category', q.category, 'emoji', q.emoji, 'color', q.color, 'is_public', q.is_public,
      'questions', COALESCE((SELECT jsonb_agg(jsonb_build_object('text', qu.text, 'time_limit', qu.time_limit, 'points', qu.points,
        'answers', COALESCE((SELECT jsonb_agg(jsonb_build_object('text', a.text, 'is_correct', a.is_correct) ORDER BY a.id) FROM public.answers a WHERE a.question_id = qu.id), '[]'::jsonb))
        ORDER BY qu.order_index) FROM public.questions qu WHERE qu.quiz_id = q.id), '[]'::jsonb))
    INTO v_previous_snapshot FROM public.quizzes q WHERE q.id = v_quiz_id;
    INSERT INTO public.quiz_versions (quiz_id, creator_id, version_number, title, category, emoji, color, is_public, snapshot)
    SELECT q.id, q.creator_id, 1, q.title, q.category, q.emoji, q.color, q.is_public, COALESCE(v_previous_snapshot, jsonb_build_object('questions', '[]'::jsonb))
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

    INSERT INTO public.questions (quiz_id, text, time_limit, points, order_index)
    VALUES (v_quiz_id, TRIM(COALESCE(v_question.question->>'text', '')), GREATEST(COALESCE((v_question.question->>'time_limit')::INTEGER, 20), 1), GREATEST(COALESCE((v_question.question->>'points')::INTEGER, 1000), 0), v_question.order_index)
    RETURNING id INTO v_question_id;

    FOR v_answer IN SELECT value AS answer FROM jsonb_array_elements(v_question.question->'answers')
    LOOP
      INSERT INTO public.answers (question_id, text, is_correct) VALUES (v_question_id, TRIM(COALESCE(v_answer.answer->>'text', '')), COALESCE((v_answer.answer->>'is_correct')::BOOLEAN, false));
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

-- record_game_result (used by Phoenix game engine)
DROP FUNCTION IF EXISTS public.record_game_result(TEXT, UUID, UUID, INTEGER, JSONB, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.record_game_result(
  p_pin TEXT, p_quiz_id UUID, p_host_id UUID, p_player_count INTEGER, p_results JSONB, p_finished_at TIMESTAMPTZ DEFAULT now()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  SELECT id INTO v_existing_id FROM public.game_results WHERE pin = p_pin LIMIT 1;

  INSERT INTO public.game_results (pin, quiz_id, host_id, player_count, results, finished_at, updated_at)
  VALUES (p_pin, p_quiz_id, p_host_id, GREATEST(COALESCE(p_player_count, 0), 0), COALESCE(p_results, '{}'::jsonb), COALESCE(p_finished_at, now()), now())
  ON CONFLICT (pin) DO UPDATE SET quiz_id = EXCLUDED.quiz_id, host_id = EXCLUDED.host_id, player_count = EXCLUDED.player_count, results = EXCLUDED.results, finished_at = EXCLUDED.finished_at, updated_at = now();

  IF v_existing_id IS NULL THEN
    UPDATE public.quizzes SET plays = COALESCE(plays, 0) + 1 WHERE id = p_quiz_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_game_result(TEXT, UUID, UUID, INTEGER, JSONB, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_game_result(TEXT, UUID, UUID, INTEGER, JSONB, TIMESTAMPTZ) TO service_role;

-- ── Done ─────────────────────────────────────────────────────

-- ============================================================
-- Image Questions Migration (2026-05-06)
-- Run this AFTER the main migration above
-- ============================================================

-- Add image_url columns
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.answers ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.quiz_draft_questions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.quiz_draft_answers ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('quiz-images', 'quiz-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Storage RLS
DROP POLICY IF EXISTS "Quiz images are publicly accessible" ON storage.objects;
CREATE POLICY "Quiz images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'quiz-images');

DROP POLICY IF EXISTS "Authenticated users can upload quiz images" ON storage.objects;
CREATE POLICY "Authenticated users can upload quiz images" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'quiz-images' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own quiz images" ON storage.objects;
CREATE POLICY "Users can delete own quiz images" ON storage.objects FOR DELETE
USING (bucket_id = 'quiz-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- Apply image-question extension and updated image-aware RPCs
-- ============================================================

-- ============================================================
-- QuizWorld Image Questions Migration
-- Run AFTER APPLY_THIS_IN_SQL_EDITOR.sql
-- ============================================================

-- ── 1. Add image_url columns ──────────────────────────────────

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.answers ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.quiz_draft_questions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.quiz_draft_answers ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ── 2. Create Storage bucket ──────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quiz-images',
  'quiz-images',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- ── 3. Storage RLS policies ───────────────────────────────────

-- Anyone can view images (public bucket)
DROP POLICY IF EXISTS "Quiz images are publicly accessible" ON storage.objects;
CREATE POLICY "Quiz images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'quiz-images');

-- Authenticated users can upload
DROP POLICY IF EXISTS "Authenticated users can upload quiz images" ON storage.objects;
CREATE POLICY "Authenticated users can upload quiz images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'quiz-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own images
DROP POLICY IF EXISTS "Users can delete own quiz images" ON storage.objects;
CREATE POLICY "Users can delete own quiz images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'quiz-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ── 4. Update publish_quiz RPC ────────────────────────────────

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

    INSERT INTO public.questions (quiz_id, text, image_url, time_limit, points, order_index)
    VALUES (
      v_quiz_id,
      TRIM(COALESCE(v_question.question->>'text', '')),
      NULLIF(TRIM(COALESCE(v_question.question->>'image_url', '')), ''),
      GREATEST(COALESCE((v_question.question->>'time_limit')::INTEGER, 20), 1),
      GREATEST(COALESCE((v_question.question->>'points')::INTEGER, 1000), 0),
      v_question.order_index
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

-- ── 5. Update republish_quiz RPC ──────────────────────────────

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

    INSERT INTO public.questions (quiz_id, text, image_url, time_limit, points, order_index)
    VALUES (
      v_quiz_id,
      TRIM(COALESCE(v_question.question->>'text', '')),
      NULLIF(TRIM(COALESCE(v_question.question->>'image_url', '')), ''),
      GREATEST(COALESCE((v_question.question->>'time_limit')::INTEGER, 20), 1),
      GREATEST(COALESCE((v_question.question->>'points')::INTEGER, 1000), 0),
      v_question.order_index
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

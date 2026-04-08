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

ALTER TABLE public.quiz_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_draft_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_draft_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Quiz drafts read own" ON public.quiz_drafts;
DROP POLICY IF EXISTS "Quiz drafts insert own" ON public.quiz_drafts;
DROP POLICY IF EXISTS "Quiz drafts update own" ON public.quiz_drafts;
DROP POLICY IF EXISTS "Quiz drafts delete own" ON public.quiz_drafts;

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

DROP POLICY IF EXISTS "Quiz draft questions read own" ON public.quiz_draft_questions;
DROP POLICY IF EXISTS "Quiz draft questions insert own" ON public.quiz_draft_questions;
DROP POLICY IF EXISTS "Quiz draft questions update own" ON public.quiz_draft_questions;
DROP POLICY IF EXISTS "Quiz draft questions delete own" ON public.quiz_draft_questions;

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

DROP POLICY IF EXISTS "Quiz draft answers read own" ON public.quiz_draft_answers;
DROP POLICY IF EXISTS "Quiz draft answers insert own" ON public.quiz_draft_answers;
DROP POLICY IF EXISTS "Quiz draft answers update own" ON public.quiz_draft_answers;
DROP POLICY IF EXISTS "Quiz draft answers delete own" ON public.quiz_draft_answers;

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

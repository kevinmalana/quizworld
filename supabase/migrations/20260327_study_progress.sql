CREATE TABLE IF NOT EXISTS public.study_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  questions_studied INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  mastery INTEGER NOT NULL DEFAULT 0,
  last_studied TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, quiz_id)
);

ALTER TABLE public.study_progress ENABLE ROW LEVEL SECURITY;

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
USING (auth.uid() = user_id);

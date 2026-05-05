ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS question_started_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.player_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_id UUID REFERENCES public.answers(id) ON DELETE CASCADE,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  response_time_ms INTEGER NOT NULL DEFAULT 0,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS player_answers_player_question_key
ON public.player_answers(player_id, question_id);

ALTER TABLE public.player_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read player_answers"
ON public.player_answers
FOR SELECT
USING (true);

CREATE POLICY "Public insert player_answers"
ON public.player_answers
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public update player_answers"
ON public.player_answers
FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Questions read" ON public.questions;
DROP POLICY IF EXISTS "Questions read public or own" ON public.questions;
DROP POLICY IF EXISTS "Answers read" ON public.answers;
DROP POLICY IF EXISTS "Answers read public or own" ON public.answers;
DROP POLICY IF EXISTS "Game sessions read" ON public.game_sessions;
DROP POLICY IF EXISTS "Game sessions read by host" ON public.game_sessions;
DROP POLICY IF EXISTS "Players read" ON public.players;
DROP POLICY IF EXISTS "Players read by host" ON public.players;
DROP POLICY IF EXISTS "Player answers read" ON public.player_answers;
DROP POLICY IF EXISTS "Player answers read by host" ON public.player_answers;

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

CREATE POLICY "Game sessions read by host"
ON public.game_sessions
FOR SELECT
USING (auth.uid() = host_id);

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

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Auth insert quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Auth update quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Users can insert their own quizzes." ON public.quizzes;
DROP POLICY IF EXISTS "Users can update own quizzes." ON public.quizzes;
DROP POLICY IF EXISTS "Users can delete own quizzes." ON public.quizzes;
DROP POLICY IF EXISTS "Public quizzes are viewable by everyone." ON public.quizzes;

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

DROP POLICY IF EXISTS "Public read questions" ON public.questions;
DROP POLICY IF EXISTS "Auth insert questions" ON public.questions;
DROP POLICY IF EXISTS "Auth update questions" ON public.questions;
DROP POLICY IF EXISTS "Questions are viewable by everyone." ON public.questions;

CREATE POLICY "Questions read"
ON public.questions
FOR SELECT
USING (true);

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

DROP POLICY IF EXISTS "Public read answers" ON public.answers;
DROP POLICY IF EXISTS "Auth insert answers" ON public.answers;
DROP POLICY IF EXISTS "Auth update answers" ON public.answers;
DROP POLICY IF EXISTS "Answers are viewable by everyone." ON public.answers;

CREATE POLICY "Answers read"
ON public.answers
FOR SELECT
USING (true);

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

DROP POLICY IF EXISTS "Public read game_sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Public insert game_sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Public update game_sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Game sessions are viewable by everyone." ON public.game_sessions;

CREATE POLICY "Game sessions read"
ON public.game_sessions
FOR SELECT
USING (true);

CREATE POLICY "Game sessions insert by host"
ON public.game_sessions
FOR INSERT
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Game sessions update by host"
ON public.game_sessions
FOR UPDATE
USING (auth.uid() = host_id)
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Game sessions delete by host"
ON public.game_sessions
FOR DELETE
USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "Public read players" ON public.players;
DROP POLICY IF EXISTS "Public insert players" ON public.players;
DROP POLICY IF EXISTS "Public update players" ON public.players;
DROP POLICY IF EXISTS "Players are viewable by everyone." ON public.players;

CREATE POLICY "Players read"
ON public.players
FOR SELECT
USING (true);

CREATE POLICY "Players join waiting sessions"
ON public.players
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.game_sessions gs
    WHERE gs.id = session_id AND gs.status = 'waiting'
  )
);

CREATE POLICY "Players update by host"
ON public.players
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.game_sessions gs
    WHERE gs.id = session_id AND gs.host_id = auth.uid()
  )
)
WITH CHECK (
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

DROP POLICY IF EXISTS "Public read player_answers" ON public.player_answers;
DROP POLICY IF EXISTS "Public insert player_answers" ON public.player_answers;
DROP POLICY IF EXISTS "Public update player_answers" ON public.player_answers;

CREATE POLICY "Player answers read"
ON public.player_answers
FOR SELECT
USING (true);

CREATE POLICY "Player answers insert during active game"
ON public.player_answers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.players p
    JOIN public.game_sessions gs ON gs.id = p.session_id
    WHERE p.id = player_id
      AND p.session_id = session_id
      AND gs.status = 'active'
  )
);

CREATE POLICY "Player answers update by host"
ON public.player_answers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.players p
    JOIN public.game_sessions gs ON gs.id = p.session_id
    WHERE p.id = player_id
      AND p.session_id = session_id
      AND gs.host_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.players p
    JOIN public.game_sessions gs ON gs.id = p.session_id
    WHERE p.id = player_id
      AND p.session_id = session_id
      AND gs.host_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.increment_quiz_plays_on_session_start()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'waiting' AND NEW.status = 'active' THEN
    UPDATE public.quizzes
    SET plays = COALESCE(plays, 0) + 1
    WHERE id = NEW.quiz_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS increment_quiz_plays_on_session_start ON public.game_sessions;

CREATE TRIGGER increment_quiz_plays_on_session_start
AFTER UPDATE OF status ON public.game_sessions
FOR EACH ROW
EXECUTE FUNCTION public.increment_quiz_plays_on_session_start();

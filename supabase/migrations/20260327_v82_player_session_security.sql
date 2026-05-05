CREATE TABLE IF NOT EXISTS public.player_sessions (
  player_id UUID PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  access_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (access_token)
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_answers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.player_sessions FROM anon, authenticated;

DROP POLICY IF EXISTS "Players join waiting sessions" ON public.players;
DROP POLICY IF EXISTS "Public insert players" ON public.players;
DROP POLICY IF EXISTS "Player answers insert during active game" ON public.player_answers;
DROP POLICY IF EXISTS "Public insert player_answers" ON public.player_answers;

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

GRANT EXECUTE ON FUNCTION public.join_game_session(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_player_answer(UUID, UUID, UUID, INTEGER) TO anon, authenticated;

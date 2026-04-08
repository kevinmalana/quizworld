DROP POLICY IF EXISTS "Game sessions update by host" ON public.game_sessions;
DROP POLICY IF EXISTS "Public update game_sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Players update by host" ON public.players;
DROP POLICY IF EXISTS "Public update players" ON public.players;
DROP POLICY IF EXISTS "Player answers update by host" ON public.player_answers;
DROP POLICY IF EXISTS "Public update player_answers" ON public.player_answers;

DROP TRIGGER IF EXISTS increment_quiz_plays_on_session_start ON public.game_sessions;
DROP FUNCTION IF EXISTS public.increment_quiz_plays_on_session_start();

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

  RETURN v_quiz_id;
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

GRANT EXECUTE ON FUNCTION public.publish_quiz(TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_game_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reveal_current_question(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_game_session(UUID) TO authenticated;

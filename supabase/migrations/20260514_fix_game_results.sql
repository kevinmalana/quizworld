-- ============================================================
-- QuizWorld: Fix game results — aggregate player data on finish
-- Run AFTER 20260514_phase1_ai_foundations.sql
-- ============================================================

-- ── 1. New RPC: finish game + record results in one call ─────

DROP FUNCTION IF EXISTS public.finish_game_and_record_results(UUID);

CREATE OR REPLACE FUNCTION public.finish_game_and_record_results(p_session_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id UUID;
  v_status TEXT;
  v_quiz_id UUID;
  v_pin TEXT;
  v_question_index INTEGER;
  v_last_question_index INTEGER;
  v_player_count INTEGER;
  v_question_count INTEGER;
  v_players_json JSONB;
  v_breakdown_json JSONB;
  v_results_json JSONB;
BEGIN
  SELECT host_id, status, quiz_id, pin, current_question_index
  INTO v_host_id, v_status, v_quiz_id, v_pin, v_question_index
  FROM public.game_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game session not found.';
  END IF;

  IF auth.uid() IS DISTINCT FROM v_host_id THEN
    RAISE EXCEPTION 'Only the host can finish the game.';
  END IF;

  -- If already finished, just record results (idempotent)
  IF v_status = 'finished' THEN
    -- Fall through to record results
    NULL;
  ELSIF v_status = 'reveal' THEN
    -- Normal finish: was on last question reveal
    SELECT COALESCE(MAX(order_index), -1)
    INTO v_last_question_index
    FROM public.questions
    WHERE quiz_id = v_quiz_id;

    IF v_question_index < v_last_question_index THEN
      RAISE EXCEPTION 'Not at the last question yet. Advance instead.';
    END IF;

    UPDATE public.game_sessions
    SET status = 'finished',
        question_started_at = NULL
    WHERE id = p_session_id;

    UPDATE public.quizzes
    SET plays = COALESCE(plays, 0) + 1
    WHERE id = v_quiz_id;
  ELSE
    RAISE EXCEPTION 'Game must be in reveal status to finish. Current: %', v_status;
  END IF;

  -- ── Aggregate player data ──────────────────────────────────

  SELECT COUNT(*) INTO v_player_count
  FROM public.players
  WHERE session_id = p_session_id;

  SELECT COALESCE(MAX(order_index), -1) + 1
  INTO v_question_count
  FROM public.questions
  WHERE quiz_id = v_quiz_id;

  -- Build players array
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id::text,
      'nickname', p.nickname,
      'avatar', p.avatar,
      'score', p.score
    )
    ORDER BY p.score DESC
  ), '[]'::jsonb)
  INTO v_players_json
  FROM public.players p
  WHERE p.session_id = p_session_id;

  -- Build question breakdown
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'index', q.order_index,
      'question_id', q.id::text,
      'text', q.text,
      'correct_answer_text', ca.text,
      'time_limit', q.time_limit,
      'points', q.points,
      'total_responses', COALESCE(resp.total_responses, 0),
      'correct_count', COALESCE(resp.correct_count, 0),
      'accuracy_pct', COALESCE(resp.accuracy_pct, 0),
      'avg_response_time_ms', COALESCE(resp.avg_response_time_ms, 0),
      'difficulty', CASE
        WHEN COALESCE(resp.accuracy_pct, 0) >= 80 THEN 'easy'
        WHEN COALESCE(resp.accuracy_pct, 0) >= 40 THEN 'medium'
        ELSE 'hard'
      END,
      'distribution', COALESCE(resp.distribution, '[]'::jsonb),
      'responses', COALESCE(resp.responses, '[]'::jsonb)
    )
    ORDER BY q.order_index
  ), '[]'::jsonb)
  INTO v_breakdown_json
  FROM public.questions q
  LEFT JOIN public.answers ca ON ca.question_id = q.id AND ca.is_correct = true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS total_responses,
      COUNT(*) FILTER (WHERE pa.is_correct) AS correct_count,
      ROUND(COUNT(*) FILTER (WHERE pa.is_correct)::NUMERIC / GREATEST(COUNT(*), 1) * 100) AS accuracy_pct,
      ROUND(AVG(pa.response_time_ms)) AS avg_response_time_ms,
      jsonb_agg(
        jsonb_build_object(
          'answer_id', a.id::text,
          'text', a.text,
          'is_correct', a.is_correct,
          'count', ans_count.cnt,
          'percentage', ROUND(ans_count.cnt::NUMERIC / GREATEST(COUNT(*), 1) * 100)
        )
      ) AS distribution,
      jsonb_agg(
        jsonb_build_object(
          'player_id', pa.player_id::text,
          'nickname', pl.nickname,
          'avatar', pl.avatar,
          'answer_id', pa.answer_id::text,
          'is_correct', pa.is_correct,
          'points_awarded', pa.points_awarded,
          'response_time_ms', pa.response_time_ms
        )
      ) AS responses
    FROM public.player_answers pa
    JOIN public.players pl ON pl.id = pa.player_id
    JOIN public.answers a ON a.id = pa.answer_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt
      FROM public.player_answers pa2
      WHERE pa2.question_id = pa.question_id
        AND pa2.session_id = p_session_id
        AND pa2.answer_id = pa.answer_id
    ) ans_count ON true
    WHERE pa.question_id = q.id
      AND pa.session_id = p_session_id
  ) resp ON true
  WHERE q.quiz_id = v_quiz_id;

  -- Build results JSONB
  v_results_json := jsonb_build_object(
    'players', v_players_json,
    'question_count', v_question_count,
    'finished_status', 'finished',
    'question_breakdown', v_breakdown_json
  );

  -- Upsert into game_results
  INSERT INTO public.game_results (
    pin, quiz_id, host_id, player_count, results, finished_at, updated_at
  )
  VALUES (
    v_pin, v_quiz_id, v_host_id, v_player_count, v_results_json, now(), now()
  )
  ON CONFLICT (pin) DO UPDATE
  SET
    player_count = EXCLUDED.player_count,
    results = EXCLUDED.results,
    finished_at = EXCLUDED.finished_at,
    updated_at = now();

  RETURN 'finished';
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_game_and_record_results(UUID) TO authenticated;

-- ── 2. Fix RLS: allow anyone to read game_results by pin ─────

DROP POLICY IF EXISTS "Game results read own host results" ON public.game_results;
DROP POLICY IF EXISTS "Game results public read" ON public.game_results;

CREATE POLICY "Game results public read"
ON public.game_results
FOR SELECT
USING (true);

-- ── 3. Also allow anon to read players and player_answers ────
-- (needed if report page ever reads directly from these tables)

DROP POLICY IF EXISTS "Players read by host" ON public.players;
DROP POLICY IF EXISTS "Players public read" ON public.players;

CREATE POLICY "Players public read"
ON public.players
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Player answers read by host" ON public.player_answers;
DROP POLICY IF EXISTS "Player answers public read" ON public.player_answers;

CREATE POLICY "Player answers public read"
ON public.player_answers
FOR SELECT
USING (true);

-- ── Done ─────────────────────────────────────────────────────

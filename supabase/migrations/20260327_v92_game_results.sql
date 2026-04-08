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

ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Game results read own host results" ON public.game_results;

CREATE POLICY "Game results read own host results"
ON public.game_results
FOR SELECT
USING (auth.uid() = host_id);

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

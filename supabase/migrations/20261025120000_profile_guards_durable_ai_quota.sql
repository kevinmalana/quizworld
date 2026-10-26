-- Apply this exact migration in one transaction; do not replay historical migrations.
-- Profile creation remains the postgres-owned SECURITY DEFINER auth signup trigger.
-- The browser profile form writes only these five presentation/audit fields.
REVOKE INSERT, UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
-- Table-level REVOKE does not remove separately granted column privileges.
DO $$
DECLARE v_columns text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO v_columns
  FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE INSERT (%s), UPDATE (%s) ON TABLE public.profiles FROM PUBLIC, anon, authenticated', v_columns, v_columns);
END;
$$;
GRANT UPDATE (username, display_name, avatar, updated_at, username_changed_at)
  ON TABLE public.profiles TO authenticated;

-- These legacy client-controlled rewards bypass completion validation; no UI caller
-- remains. SECURITY DEFINER completion functions still run as their postgres owner.
REVOKE ALL ON FUNCTION public.increment_xp(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_study_streak(uuid) FROM PUBLIC, anon, authenticated;

-- One bounded row/account, with at most seven route windows. No browser table access.
CREATE TABLE public.ai_request_quotas (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_count integer NOT NULL DEFAULT 0 CHECK (daily_count BETWEEN 0 AND 50),
  daily_reset_at timestamptz NOT NULL,
  route_windows jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.ai_request_quotas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_request_quotas FROM PUBLIC, anon, authenticated, service_role;

-- Only the trusted API server can supply user_id, after auth.getUser(). Limits and
-- clock are owned here, never supplied by the client. One row lock atomically
-- checks AND reserves both limits across all server instances and route paths.
CREATE FUNCTION public.consume_ai_request_quota(p_user_id uuid, p_path text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max integer;
  v_ai boolean;
  v_now timestamptz;
  v_row public.ai_request_quotas%ROWTYPE;
  v_window jsonb;
  v_count integer;
  v_reset timestamptz;
BEGIN
  v_max := CASE p_path
    WHEN '/api/ai-source-draft' THEN 15
    WHEN '/api/ai-presentation-draft' THEN 10
    WHEN '/api/import-url' THEN 10
    WHEN '/api/ai-enrich' THEN 20
    WHEN '/api/present/import-pdf' THEN 10
    WHEN '/api/present/import-deck' THEN 10
    WHEN '/api/ai-game-insights' THEN 10
    ELSE NULL END;
  IF v_max IS NULL THEN RAISE EXCEPTION 'Unsupported quota route' USING ERRCODE = '22023'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Quota identity required' USING ERRCODE = '22023'; END IF;
  v_ai := p_path LIKE '/api/ai-%';

  INSERT INTO public.ai_request_quotas(user_id, daily_reset_at)
  VALUES (p_user_id, clock_timestamp() + interval '24 hours')
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO STRICT v_row FROM public.ai_request_quotas WHERE user_id = p_user_id FOR UPDATE;
  v_now := clock_timestamp(); -- After waiting for the account lock.
  -- Imports do not start the AI allowance's 24-hour window.
  IF v_now >= v_row.daily_reset_at OR (v_ai AND v_row.daily_count = 0) THEN
    v_row.daily_count := 0;
    v_row.daily_reset_at := v_now + interval '24 hours';
  END IF;
  v_window := v_row.route_windows -> p_path;
  v_reset := (v_window ->> 'reset_at')::timestamptz;
  v_count := COALESCE((v_window ->> 'count')::integer, 0);
  IF v_reset IS NULL OR v_now >= v_reset THEN
    v_count := 0;
    v_reset := v_now + interval '1 minute';
  END IF;

  IF v_ai AND v_row.daily_count >= 50 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'daily', 'limit', 50,
      'retry_after', GREATEST(1, ceil(extract(epoch FROM v_row.daily_reset_at - v_now))::integer),
      'reset_at', ceil(extract(epoch FROM v_row.daily_reset_at))::bigint);
  END IF;
  IF v_count >= v_max THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'route', 'limit', v_max,
      'retry_after', GREATEST(1, ceil(extract(epoch FROM v_reset - v_now))::integer),
      'reset_at', ceil(extract(epoch FROM v_reset))::bigint);
  END IF;

  UPDATE public.ai_request_quotas SET
    daily_count = v_row.daily_count + CASE WHEN v_ai THEN 1 ELSE 0 END,
    daily_reset_at = v_row.daily_reset_at,
    route_windows = jsonb_set(v_row.route_windows, ARRAY[p_path],
      jsonb_build_object('count', v_count + 1, 'reset_at', v_reset))
  WHERE user_id = p_user_id;
  RETURN jsonb_build_object('allowed', true);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_ai_request_quota(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_request_quota(uuid, text) TO service_role;

-- Lock down game_data RLS — 2026-08-13 (fixed)

SET search_path TO public;

-- ── 1. game_results: host-only SELECT ──────────────────────

DROP POLICY IF EXISTS "Game results read own host results" ON public.game_results;
DROP POLICY IF EXISTS "Game results public read" ON public.game_results;
DROP POLICY IF EXISTS "Game results read by host" ON public.game_results;

CREATE POLICY "Game results read by host"
ON public.game_results
FOR SELECT
USING (auth.uid() = host_id);


-- ── 2. players: SELECT by host OR by anyone during active game ──────
-- Note: player_token (the per-player access token) lives on
-- player_sessions (column: access_token), not on players. So the
-- "self" branch joins via player_sessions.

DROP POLICY IF EXISTS "Players read by host" ON public.players;
DROP POLICY IF EXISTS "Players public read" ON public.players;
DROP POLICY IF EXISTS "Players read by host or self" ON public.players;

CREATE POLICY "Players read by host"
ON public.players
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.game_sessions gs
    WHERE gs.id = players.session_id
      AND gs.host_id = auth.uid()
  )
);

CREATE POLICY "Players read during active game"
ON public.players
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.game_sessions gs
    WHERE gs.id = players.session_id
      AND gs.status IN ('waiting', 'active', 'reveal')
  )
);

-- Self-read via the player_sessions table (where the actual player_token lives)
CREATE POLICY "Players read by self"
ON public.players
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.player_sessions ps
    WHERE ps.player_id = players.id
      AND ps.access_token::text = auth.uid()::text
  )
);


-- ── 3. player_answers: SELECT by host only ─────────────────

DROP POLICY IF EXISTS "Player answers read by host" ON public.player_answers;
DROP POLICY IF EXISTS "Player answers public read" ON public.player_answers;

CREATE POLICY "Player answers read by host"
ON public.player_answers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.players p
    JOIN public.game_sessions gs ON gs.id = p.session_id
    WHERE p.id = player_answers.player_id
      AND gs.host_id = auth.uid()
  )
);


-- ── 4. Ensure RLS is enabled ───────────────────────────────────────────

ALTER TABLE public.game_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_answers ENABLE ROW LEVEL SECURITY;


-- ── 5. Service-role bypass for backend recovery / data-pipeline ──

GRANT SELECT ON public.game_results   TO service_role;
GRANT SELECT ON public.players        TO service_role;
GRANT SELECT ON public.player_answers TO service_role;

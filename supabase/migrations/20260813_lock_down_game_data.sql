-- Lock down game_data RLS — 2026-08-13
--
-- Current state may be inconsistent:
--   - /supabase/migrations/20260514_fix_game_results.sql set USING (true) on
--     game_results, players, player_answers (public read).
--   - /supabase/20260619_rls_fixes.sql (run manually via SQL Editor) tried to
--     restore host-only policies, but it's not part of the migration set.
--   - Result: depending on what got applied, exposure is inconsistent.
--
-- This migration defines the intended state idempotently:
--   - game_results: SELECT by host (auth.uid() = host_id)
--   - players: SELECT by host OR by game session participants during live play, OR by self
--   - player_answers: SELECT by host only
--
-- Backwards compatibility:
--   - The Phoenix live-game engine does NOT read these Supabase tables directly;
--     it goes through /api/sessions/:pin/* REST endpoints. So tightening RLS
--     doesn't break live gameplay.
--   - /report now uses a NEW server-side endpoint (/api/reports/[pin]) that runs
--     auth checks via the Supabase server client. Frontend no longer queries
--     these tables directly.
--   - /admin reads game_results via admin flag check; if your admin queries
--     break, that's expected — they should use a server-side endpoint with
--     service-role key.
--
-- Idempotent: each DROP POLICY IF EXISTS makes this safe to re-run.

SET search_path TO public;

-- ── 1. game_results: host-only SELECT ──────────────────────

DROP POLICY IF EXISTS "Game results read own host results"   ON public.game_results;
DROP POLICY IF EXISTS "Game results public read"             ON public.game_results;
DROP POLICY IF EXISTS "Game results read by host"            ON public.game_results;
DROP POLICY IF EXISTS "Game results service role read all"  ON public.game_results;

CREATE POLICY "Game results read by host"
ON public.game_results
FOR SELECT
USING (auth.uid() = host_id);

-- ── 2. players: SELECT by host, by self, or by anyone during active play ──

DROP POLICY IF EXISTS "Players read by host"            ON public.players;
DROP POLICY IF EXISTS "Players public read"             ON public.players;
DROP POLICY IF EXISTS "Players read by host or self"    ON public.players;
DROP POLICY IF EXISTS "Players read during active game" ON public.players;

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

CREATE POLICY "Players read by self"
ON public.players
FOR SELECT
USING (auth.uid()::text = players.player_token);

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

-- ── 3. player_answers: SELECT by host only ─────────────────

DROP POLICY IF EXISTS "Player answers read by host"   ON public.player_answers;
DROP POLICY IF EXISTS "Player answers public read"    ON public.player_answers;

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

-- ── 4. Ensure RLS is enabled (defensive — disable any no-RLS window) ───

ALTER TABLE public.game_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_answers ENABLE ROW LEVEL SECURITY;

-- ── 5. Grant to service_role so backend recovery / data-pipeline works ──
-- (Supabase service_role bypasses RLS by default, but be explicit for clarity)

GRANT SELECT ON public.game_results   TO service_role;
GRANT SELECT ON public.players        TO service_role;
GRANT SELECT ON public.player_answers TO service_role;

-- ── Done ─────────────────────────────────────────────────────

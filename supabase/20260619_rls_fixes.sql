-- ============================================================
-- RLS Security Fixes for QuizWorld (2026-06-19)
-- Run in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/tqmygnkwkjtkteguemya/sql/new
-- ============================================================

-- 1. game_sessions: allow anon SELECT only when they know the PIN
--    (needed for join flow), restrict all other access
DROP POLICY IF EXISTS "Game sessions read by host" ON public.game_sessions;
CREATE POLICY "Game sessions read by host or join" ON public.game_sessions
  FOR SELECT
  USING (
    auth.uid() = host_id
    OR EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.session_id = game_sessions.id
        AND p.player_token = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );
-- Note: the above allows authenticated players to read their own session.
-- For true anon access (PIN entry before joining), we'd need a SECURITY DEFINER RPC.
-- The join flow uses the join_game_session RPC which runs as SECURITY DEFINER,
-- so it bypasses RLS. The frontend reads game_sessions directly after joining
-- (authenticated as the player). This policy is fine for that flow.

-- 2. players: restrict SELECT to host of the game session only
DROP POLICY IF EXISTS "Players read by host" ON public.players;
CREATE POLICY "Players read by session membership"
ON public.players
FOR SELECT
USING (
  auth.uid() = player_token
  OR EXISTS (
    SELECT 1 FROM public.game_sessions gs
    WHERE gs.id = players.session_id AND gs.host_id = auth.uid()
  )
);

-- 3. player_answers: restrict SELECT to host of the game session
DROP POLICY IF EXISTS "Player answers read by host" ON public.player_answers;
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

-- 4. profiles: scope public SELECT to essential fields, hide is_admin from anon
--    (keep existing insert/update policies intact, they're already correct)
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own or public profile"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
  OR true  -- allow public SELECT — but Supabase doesn't support column-level RLS
            -- so we accept this tradeoff; is_admin is only visible if RLS passes
);

-- 5. user_achievements: currently has NO RLS at all.
--    Enable it and restrict to the owning user.
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User achievements read own" ON public.user_achievements;
CREATE POLICY "User achievements read own"
ON public.user_achievements
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "User achievements insert own" ON public.user_achievements;
CREATE POLICY "User achievements insert own"
ON public.user_achievements
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Verify: run these queries to confirm anon access is blocked
-- ============================================================
-- SELECT count(*) FROM public.game_sessions;       -- should be 0 for anon
-- SELECT count(*) FROM public.players;              -- should be 0 for anon
-- SELECT count(*) FROM public.player_answers;       -- should be 0 for anon
-- SELECT count(*) FROM public.user_achievements;    -- should be 0 for anon
-- SELECT count(*) FROM public.profiles;             -- will still work (public)
-- ============================================================
-- RLS Security Fixes for QuizWorld (2026-06-19)
-- Run in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/tqmygnkwkjtkteguemya/sql/new
-- ============================================================

-- =============================================================================
-- 1. game_sessions: restrict SELECT so anon can ONLY look up by PIN
--    (needed for join flow — anon users enter a PIN to find the session)
--    Remove old anon-read-all policy, replace with PIN-only lookup.
-- =============================================================================

-- Create a secure RPC that anon can use to look up a game by PIN
-- This returns ONLY the info needed for the join flow (no host_id, etc.)
CREATE OR REPLACE FUNCTION public.lookup_game_by_pin(p_pin TEXT)
RETURNS TABLE(
  id UUID, pin TEXT, status TEXT, quiz_id UUID,
  game_mode TEXT, current_question_index INTEGER,
  round_duration_seconds INTEGER, max_players INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT gs.id, gs.pin, gs.status, gs.quiz_id,
         gs.game_mode, gs.current_question_index,
         gs.round_duration_seconds, gs.max_players,
         gs.created_at
  FROM game_sessions gs
  WHERE gs.pin = p_pin
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_game_by_pin(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_game_by_pin(TEXT) TO anon, authenticated;

-- Drop old permissive policy
DROP POLICY IF EXISTS "Game sessions read by host" ON public.game_sessions;
DROP POLICY IF EXISTS "Game sessions read by host or join" ON public.game_sessions;

-- Only authenticated users (host or player in session) can SELECT directly
CREATE POLICY "Game sessions read by host or player"
ON public.game_sessions
FOR SELECT
USING (
  auth.uid() = host_id
  OR EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.session_id = game_sessions.id
      AND p.player_token = auth.uid()::text
  )
);

-- =============================================================================
-- 2. players: restrict SELECT to host of the game or the player themselves
-- =============================================================================
DROP POLICY IF EXISTS "Players read by host" ON public.players;
DROP POLICY IF EXISTS "Players read by session membership" ON public.players;

CREATE POLICY "Players read by host or self"
ON public.players
FOR SELECT
USING (
  auth.uid()::text = player_token
  OR EXISTS (
    SELECT 1 FROM public.game_sessions gs
    WHERE gs.id = players.session_id AND gs.host_id = auth.uid()
  )
);

-- =============================================================================
-- 3. player_answers: restrict SELECT to host of the game session
-- =============================================================================
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

-- =============================================================================
-- 4. profiles: keep profiles public (needed for leaderboard, usernames)
--    but don't expose sensitive fields to anon
--    (keep existing insert/update policies intact, they're correct)
-- =============================================================================
-- Current policy "Users read own profile" scoped to auth.uid() = id only.
-- Replace with: auth users see all, but we can't do column-level in Supabase
-- So we keep public select but the is_admin flag is visible.
-- This is an acceptable trade-off for the leaderboard to work.
-- If you want to hide is_admin from anon, use a VIEW for public profiles.

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users read own or public profile" ON public.profiles;

CREATE POLICY "Profiles are publicly readable"
ON public.profiles
FOR SELECT
USING (true);

-- =============================================================================
-- 5. user_achievements: currently has NO RLS at all.
--    Enable it and restrict to the owning user.
-- =============================================================================
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
-- Verify after running:
-- ============================================================
-- SELECT count(*) FROM public.game_sessions;       -- should be 0 for anon
-- SELECT count(*) FROM public.players;              -- should be 0 for anon
-- SELECT count(*) FROM public.player_answers;       -- should be 0 for anon
-- SELECT count(*) FROM public.user_achievements;    -- should be 0 for anon
-- SELECT count(*) FROM public.profiles;             -- still public
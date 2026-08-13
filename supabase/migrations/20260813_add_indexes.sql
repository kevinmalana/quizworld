-- 2026-08-13: Performance indexes for QuizWorld DB.
-- Today's catalog size: ~hundreds of quizzes / thousands of game_results.
-- Without these, every /explore, /dashboard, /join lookup is a full table scan.
--
-- Run order is irrelevant; all CREATE INDEX IF NOT EXISTS are idempotent.

SET search_path TO public;

-- /explore + /study: top quizzes ordered by plays (most important)
CREATE INDEX IF NOT EXISTS idx_quizzes_plays_desc_public_active
  ON public.quizzes (plays DESC)
  WHERE archived_at IS NULL AND is_public = true;

-- /host (My Quizzes) + /study: user-scoped ordering by created_at
CREATE INDEX IF NOT EXISTS idx_quizzes_creator_created
  ON public.quizzes (creator_id, created_at DESC);

-- /dashboard game_results by host (host sees their hosted games)
CREATE INDEX IF NOT EXISTS idx_game_results_host
  ON public.game_results (host_id);

-- /report/[pin] — host fetches by pin
CREATE INDEX IF NOT EXISTS idx_game_results_pin
  ON public.game_results (pin);

-- /join lookup_game_by_pin RPC
CREATE INDEX IF NOT EXISTS idx_game_sessions_pin
  ON public.game_sessions (pin);

-- /dashboard game_sessions by host
CREATE INDEX IF NOT EXISTS idx_game_sessions_host
  ON public.game_sessions (host_id);

-- /leaderboard ORDER BY total_xp DESC LIMIT 50
CREATE INDEX IF NOT EXISTS idx_profiles_total_xp
  ON public.profiles (total_xp DESC)
  WHERE total_xp IS NOT NULL;

-- /classrooms — `from: classroom_members where user_id` and `from: classroom_members where classroom_id`
CREATE INDEX IF NOT EXISTS idx_classroom_members_user
  ON public.classroom_members (user_id);

-- Foreign key indexes (Supabase/Postgres does NOT auto-create these)
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON public.questions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON public.answers (question_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_user ON public.study_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_created
  ON public.study_sessions (user_id, created_at DESC);

-- ── Done ────────────────────────────────────────────────────────────

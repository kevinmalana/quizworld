-- Final lockdown. Apply only after Phoenix and frontend use the compatibility RPCs.
-- Browser roles never need schema-level destructive privileges. RLS does not
-- protect TRUNCATE, REFERENCES, or TRIGGER operations.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.increment_xp(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_study_streak(UUID) FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.study_sessions;
DROP POLICY IF EXISTS "Users insert own study progress" ON public.study_progress;
DROP POLICY IF EXISTS "Users update own study progress" ON public.study_progress;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.study_sessions, public.study_progress
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_achievements FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_achievement_if_eligible(TEXT) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated hosts can insert" ON public.game_results;
DROP POLICY IF EXISTS "Authenticated can read game_results" ON public.game_results;
DROP POLICY IF EXISTS "game_results auth only" ON public.game_results;
DROP POLICY IF EXISTS "Game results read own host results" ON public.game_results;
CREATE POLICY "Game results read own host results" ON public.game_results
  FOR SELECT TO authenticated USING (auth.uid() = host_id);
REVOKE INSERT, UPDATE, DELETE ON TABLE public.game_results FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.game_results TO service_role;
DROP FUNCTION IF EXISTS public.record_game_result(TEXT, UUID, UUID, INTEGER, JSONB, TIMESTAMPTZ);
DROP INDEX IF EXISTS public.game_results_pin_key;

DROP POLICY IF EXISTS "Presentations public read live" ON public.presentations;
DROP POLICY IF EXISTS "Slides public read" ON public.slides;
DROP POLICY IF EXISTS "Responses insert" ON public.slide_responses;
DROP POLICY IF EXISTS "Responses read" ON public.slide_responses;
DROP POLICY IF EXISTS "QnA insert" ON public.qna_questions;
DROP POLICY IF EXISTS "QnA read" ON public.qna_questions;
DROP POLICY IF EXISTS "QnA update" ON public.qna_questions;

REVOKE SELECT ON TABLE public.presentations, public.slides FROM anon;
REVOKE ALL ON TABLE public.slide_responses, public.qna_questions,
  public.qna_question_upvotes FROM anon, authenticated;

-- Final lockdown. Apply only after Phoenix and frontend use the compatibility RPCs.
REVOKE ALL ON FUNCTION public.increment_xp(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_study_streak(UUID) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Authenticated hosts can insert" ON public.game_results;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.game_results FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.game_results TO service_role;

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

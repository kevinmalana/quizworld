-- Presentation runtime recovery and privacy boundary.
-- Apply separately before deploying the matching Phoenix/frontend release.

-- Repair environments where the original presentation migration was only
-- partially applied. Phoenix remains the only public write/read authority.
CREATE TABLE IF NOT EXISTS public.qna_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id UUID NOT NULL REFERENCES public.slides(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  participant_name TEXT DEFAULT 'Anonymous',
  question TEXT NOT NULL,
  upvotes INTEGER NOT NULL DEFAULT 0,
  answered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qna_questions_slide
  ON public.qna_questions(slide_id);

CREATE TABLE IF NOT EXISTS public.qna_question_upvotes (
  question_id UUID NOT NULL REFERENCES public.qna_questions(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, participant_id)
);

ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slide_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qna_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qna_question_upvotes ENABLE ROW LEVEL SECURITY;

-- Remove the original anonymous answer-key and participant-data exposure.
DROP POLICY IF EXISTS "Slides public read" ON public.slides;
DROP POLICY IF EXISTS "Responses insert" ON public.slide_responses;
DROP POLICY IF EXISTS "Responses read" ON public.slide_responses;
DROP POLICY IF EXISTS "QnA insert" ON public.qna_questions;
DROP POLICY IF EXISTS "QnA read" ON public.qna_questions;
DROP POLICY IF EXISTS "QnA update" ON public.qna_questions;
DROP POLICY IF EXISTS "QnA upvotes no anon" ON public.qna_question_upvotes;

-- Deck owners retain direct editor access. Audience access is through the
-- sanitized Phoenix snapshot/activity endpoints with issued session tokens.
DROP POLICY IF EXISTS "Slides creator CRUD" ON public.slides;
CREATE POLICY "Slides creator CRUD" ON public.slides
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.presentations p
      WHERE p.id = presentation_id AND p.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.presentations p
      WHERE p.id = presentation_id AND p.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Responses no direct client access" ON public.slide_responses;
CREATE POLICY "Responses no direct client access" ON public.slide_responses
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "QnA no direct client access" ON public.qna_questions;
CREATE POLICY "QnA no direct client access" ON public.qna_questions
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "QnA upvotes no direct client access" ON public.qna_question_upvotes;
CREATE POLICY "QnA upvotes no direct client access" ON public.qna_question_upvotes
  FOR ALL USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.slide_responses FROM anon, authenticated;
REVOKE ALL ON TABLE public.qna_questions FROM anon, authenticated;
REVOKE ALL ON TABLE public.qna_question_upvotes FROM anon, authenticated;

-- QuizWorld Present — live authority hardening
-- Adds durable live-session and participant-token tables for Phoenix-authoritative presentations.

CREATE TABLE IF NOT EXISTS public.presentation_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES public.presentations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'finished')),
  presenter_token TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  UNIQUE (presentation_id)
);

CREATE TABLE IF NOT EXISTS public.presentation_participants (
  id TEXT PRIMARY KEY,
  presentation_id UUID NOT NULL REFERENCES public.presentations(id) ON DELETE CASCADE,
  participant_token TEXT NOT NULL,
  participant_name TEXT NOT NULL DEFAULT 'Anonymous',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presentation_live_sessions_presentation
  ON public.presentation_live_sessions(presentation_id, status);

CREATE INDEX IF NOT EXISTS idx_presentation_participants_presentation
  ON public.presentation_participants(presentation_id, joined_at);

CREATE TABLE IF NOT EXISTS public.qna_question_upvotes (
  question_id UUID NOT NULL REFERENCES public.qna_questions(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, participant_id)
);

ALTER TABLE public.presentation_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qna_question_upvotes ENABLE ROW LEVEL SECURITY;

-- No public direct access. Phoenix service-role owns these rows.
DROP POLICY IF EXISTS "Presentation live sessions no anon" ON public.presentation_live_sessions;
CREATE POLICY "Presentation live sessions no anon" ON public.presentation_live_sessions
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Presentation participants no anon" ON public.presentation_participants;
CREATE POLICY "Presentation participants no anon" ON public.presentation_participants
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "QnA upvotes no anon" ON public.qna_question_upvotes;
CREATE POLICY "QnA upvotes no anon" ON public.qna_question_upvotes
  FOR ALL USING (false) WITH CHECK (false);

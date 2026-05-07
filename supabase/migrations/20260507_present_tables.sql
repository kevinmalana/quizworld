-- QuizWorld Present — Presentation mode tables
-- Run in Supabase SQL Editor

-- Presentations
CREATE TABLE IF NOT EXISTS public.presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Presentation',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'finished')),
  join_code TEXT UNIQUE,
  current_slide_index INTEGER NOT NULL DEFAULT 0,
  settings JSONB DEFAULT '{}',
  results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

-- Slides
CREATE TABLE IF NOT EXISTS public.slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES public.presentations(id) ON DELETE CASCADE,
  slide_type TEXT NOT NULL CHECK (slide_type IN ('content', 'word_cloud', 'open_text', 'poll', 'quiz', 'scale', 'qna')),
  title TEXT DEFAULT '',
  content JSONB NOT NULL DEFAULT '{}',
  order_index INTEGER NOT NULL DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audience responses
CREATE TABLE IF NOT EXISTS public.slide_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id UUID NOT NULL REFERENCES public.slides(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  participant_name TEXT DEFAULT 'Anonymous',
  response_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Q&A questions with upvoting
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_presentations_creator ON public.presentations(creator_id);
CREATE INDEX IF NOT EXISTS idx_presentations_join_code ON public.presentations(join_code);
CREATE INDEX IF NOT EXISTS idx_slides_presentation ON public.slides(presentation_id, order_index);
CREATE INDEX IF NOT EXISTS idx_slide_responses_slide ON public.slide_responses(slide_id);
CREATE INDEX IF NOT EXISTS idx_qna_questions_slide ON public.qna_questions(slide_id);

-- RLS
ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slide_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qna_questions ENABLE ROW LEVEL SECURITY;

-- Presentations: creator can CRUD, anyone can read live ones
DROP POLICY IF EXISTS "Presentations creator CRUD" ON public.presentations;
CREATE POLICY "Presentations creator CRUD" ON public.presentations
  FOR ALL USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Presentations public read live" ON public.presentations;
CREATE POLICY "Presentations public read live" ON public.presentations
  FOR SELECT USING (status = 'live' OR status = 'finished');

-- Slides: creator can CRUD, anyone can read
DROP POLICY IF EXISTS "Slides creator CRUD" ON public.slides;
CREATE POLICY "Slides creator CRUD" ON public.slides
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.presentations p WHERE p.id = presentation_id AND p.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "Slides public read" ON public.slides;
CREATE POLICY "Slides public read" ON public.slides FOR SELECT USING (true);

-- Responses: anyone can insert, creator can read
DROP POLICY IF EXISTS "Responses insert" ON public.slide_responses;
CREATE POLICY "Responses insert" ON public.slide_responses FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Responses read" ON public.slide_responses;
CREATE POLICY "Responses read" ON public.slide_responses FOR SELECT USING (true);

-- Q&A: anyone can insert/update, creator can read
DROP POLICY IF EXISTS "QnA insert" ON public.qna_questions;
CREATE POLICY "QnA insert" ON public.qna_questions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "QnA read" ON public.qna_questions;
CREATE POLICY "QnA read" ON public.qna_questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "QnA update" ON public.qna_questions;
CREATE POLICY "QnA update" ON public.qna_questions FOR UPDATE USING (true);

-- RPC: Create presentation with slides
CREATE OR REPLACE FUNCTION public.create_presentation(
  p_title TEXT,
  p_slides JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_presentation_id UUID;
  v_join_code TEXT;
  v_slide JSONB;
  v_index INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF p_title = '' THEN p_title := 'Untitled Presentation'; END IF;

  -- Generate unique 6-char join code
  LOOP
    v_join_code := upper(substring(md5(random()::text) from 1 for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.presentations WHERE join_code = v_join_code);
  END LOOP;

  INSERT INTO public.presentations (creator_id, title, join_code)
  VALUES (v_user_id, p_title, v_join_code)
  RETURNING id INTO v_presentation_id;

  IF jsonb_typeof(p_slides) = 'array' THEN
    FOR v_slide IN SELECT value FROM jsonb_array_elements(p_slides) LOOP
      INSERT INTO public.slides (presentation_id, slide_type, title, content, order_index, settings)
      VALUES (
        v_presentation_id,
        COALESCE(v_slide->>'slide_type', 'content'),
        COALESCE(v_slide->>'title', ''),
        COALESCE(v_slide->'content', '{}'::jsonb),
        v_index,
        COALESCE(v_slide->'settings', '{}'::jsonb)
      );
      v_index := v_index + 1;
    END LOOP;
  END IF;

  RETURN v_presentation_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_presentation(TEXT, JSONB) TO authenticated;

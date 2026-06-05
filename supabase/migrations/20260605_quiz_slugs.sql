-- Migration: Add slug column to quizzes for SEO-friendly URLs
-- Safe: keeps UUID routes working, slugs are additive only

-- 1. Add slug column
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Create unique index (partial - only for non-null slugs)
CREATE UNIQUE INDEX IF NOT EXISTS quizzes_slug_unique 
  ON public.quizzes (slug) 
  WHERE slug IS NOT NULL;

-- 3. Generate slugs for all existing public quizzes
-- Format: lowercase, spaces→hyphens, strip special chars, deduplicate with -2/-3 etc.
DO $$
DECLARE
  rec RECORD;
  base_slug TEXT;
  candidate TEXT;
  counter INT;
BEGIN
  FOR rec IN 
    SELECT id, title FROM public.quizzes 
    WHERE slug IS NULL AND archived_at IS NULL
    ORDER BY created_at ASC
  LOOP
    -- Build base slug from title
    base_slug := lower(rec.title);
    base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(both '-' from base_slug);
    base_slug := left(base_slug, 80);

    -- Handle empty slug fallback
    IF base_slug = '' THEN
      base_slug := 'quiz-' || substr(rec.id::text, 1, 8);
    END IF;

    -- Deduplicate
    candidate := base_slug;
    counter := 2;
    WHILE EXISTS (SELECT 1 FROM public.quizzes WHERE slug = candidate AND id != rec.id) LOOP
      candidate := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;

    UPDATE public.quizzes SET slug = candidate WHERE id = rec.id;
  END LOOP;
END $$;

-- 4. Function to auto-generate slug on new quiz insert/title update
CREATE OR REPLACE FUNCTION public.generate_quiz_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter INT;
BEGIN
  -- Only generate if slug is null or title changed
  IF NEW.slug IS NOT NULL AND (TG_OP = 'UPDATE' AND OLD.title = NEW.title) THEN
    RETURN NEW;
  END IF;

  IF NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;

  base_slug := lower(NEW.title);
  base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  base_slug := left(base_slug, 80);

  IF base_slug = '' THEN
    base_slug := 'quiz-' || substr(NEW.id::text, 1, 8);
  END IF;

  candidate := base_slug;
  counter := 2;
  WHILE EXISTS (SELECT 1 FROM public.quizzes WHERE slug = candidate AND id != NEW.id) LOOP
    candidate := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quiz_slug_trigger ON public.quizzes;
CREATE TRIGGER quiz_slug_trigger
  BEFORE INSERT ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.generate_quiz_slug();

-- 5. RLS: slug is readable publicly (same as other quiz fields)
-- No additional policy needed - slug is just another column on quizzes
-- which already has public read policy

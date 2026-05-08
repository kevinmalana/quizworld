-- QuizWorld Present — atomic slide save that preserves existing slide IDs/responses.

CREATE OR REPLACE FUNCTION public.save_presentation(
  p_presentation_id UUID,
  p_title TEXT,
  p_slides JSONB
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_slide JSONB;
  v_index INTEGER := 0;
  v_slide_id UUID;
  v_keep_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.presentations
    WHERE id = p_presentation_id AND creator_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Presentation not found.';
  END IF;

  UPDATE public.presentations
  SET title = COALESCE(NULLIF(trim(p_title), ''), 'Untitled Presentation')
  WHERE id = p_presentation_id;

  IF jsonb_typeof(p_slides) <> 'array' THEN
    RAISE EXCEPTION 'Slides must be an array.';
  END IF;

  FOR v_slide IN SELECT value FROM jsonb_array_elements(p_slides) LOOP
    v_slide_id := NULL;

    BEGIN
      IF COALESCE(v_slide->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_slide_id := (v_slide->>'id')::UUID;
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      v_slide_id := NULL;
    END;

    IF v_slide_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.slides WHERE id = v_slide_id AND presentation_id = p_presentation_id
    ) THEN
      UPDATE public.slides
      SET slide_type = COALESCE(v_slide->>'slide_type', 'content'),
          title = COALESCE(v_slide->>'title', ''),
          content = COALESCE(v_slide->'content', '{}'::jsonb),
          order_index = v_index,
          settings = COALESCE(v_slide->'settings', '{}'::jsonb)
      WHERE id = v_slide_id AND presentation_id = p_presentation_id;
    ELSE
      INSERT INTO public.slides (presentation_id, slide_type, title, content, order_index, settings)
      VALUES (
        p_presentation_id,
        COALESCE(v_slide->>'slide_type', 'content'),
        COALESCE(v_slide->>'title', ''),
        COALESCE(v_slide->'content', '{}'::jsonb),
        v_index,
        COALESCE(v_slide->'settings', '{}'::jsonb)
      )
      RETURNING id INTO v_slide_id;
    END IF;

    v_keep_ids := array_append(v_keep_ids, v_slide_id);
    v_index := v_index + 1;
  END LOOP;

  DELETE FROM public.slides
  WHERE presentation_id = p_presentation_id
    AND NOT (id = ANY(v_keep_ids));
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_presentation(UUID, TEXT, JSONB) TO authenticated;

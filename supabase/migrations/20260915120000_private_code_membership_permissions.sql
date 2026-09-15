-- Private code redemption and assignment authorization.
-- Additive RPCs / policy hardening only; no data rewrite or private SELECT widening.
-- Apply this exact file only after review. See docs/permission-repairs.md.

CREATE FUNCTION public.join_trivia_group_by_code(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_code text := pg_catalog.upper(pg_catalog.btrim(p_code));
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF v_code IS NULL OR v_code !~ '^[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid group code.' USING ERRCODE = '22023';
  END IF;
  SELECT g.id INTO v_id FROM public.trivia_groups g WHERE g.join_code = v_code;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Invalid group code.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.trivia_group_members(group_id, user_id, role)
  VALUES(v_id, v_actor, 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.join_trivia_group_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_trivia_group_by_code(text) TO authenticated;

CREATE FUNCTION public.join_classroom_by_code(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_code text := pg_catalog.upper(pg_catalog.btrim(p_code));
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF v_code IS NULL OR v_code !~ '^[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid classroom code.' USING ERRCODE = '22023';
  END IF;
  SELECT c.id INTO v_id FROM public.classrooms c WHERE c.join_code = v_code;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Invalid classroom code.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.classroom_members(classroom_id, user_id, role)
  VALUES(v_id, v_actor, 'student')
  ON CONFLICT (classroom_id, user_id) DO NOTHING;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.join_classroom_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_classroom_by_code(text) TO authenticated;

-- A private UUID is not an invitation, nor may callers choose elevated roles.
-- Preserve existing owner bootstrap and public group discovery paths.
ALTER POLICY trivia_group_members_insert ON public.trivia_group_members
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.trivia_groups g WHERE g.id = group_id
        AND ((g.is_public AND role = 'member') OR (g.created_by = auth.uid() AND role = 'admin'))
    )
  );
ALTER POLICY classroom_members_insert ON public.classroom_members
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND role = 'teacher' AND EXISTS (
      SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.created_by = auth.uid()
    )
  );

-- The previous policy checked assigned_by only, not teacher authority.
ALTER POLICY "Teachers can create assignments" ON public.classroom_assignments
  TO authenticated
  WITH CHECK (
    assigned_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.classroom_members cm
      WHERE cm.classroom_id = classroom_assignments.classroom_id
        AND cm.user_id = auth.uid() AND cm.role = 'teacher'
    )
  );
CREATE POLICY "Teachers can delete assignments" ON public.classroom_assignments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_members cm
      WHERE cm.classroom_id = classroom_assignments.classroom_id
        AND cm.user_id = auth.uid() AND cm.role = 'teacher'
    )
  );

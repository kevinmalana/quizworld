-- Apply after 20260915120000. No table/data/role rewrites.

-- Keep anon execution because public SELECT policies invoke these helpers.
-- Anonymous and arbitrary-other-user queries return false, never membership data.
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND p_user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.trivia_group_members
    WHERE group_id = p_group_id AND user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.is_classroom_member(p_classroom_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND p_user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.classroom_members
    WHERE classroom_id = p_classroom_id AND user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_classroom_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_classroom_member(uuid, uuid) TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.is_classroom_teacher(p_classroom_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND p_user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.classroom_members
    WHERE classroom_id = p_classroom_id AND user_id = auth.uid() AND role = 'teacher'
  );
$$;
REVOKE ALL ON FUNCTION public.is_classroom_teacher(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_classroom_teacher(uuid, uuid) TO anon, authenticated;

-- Group SELECT RLS already expresses public OR creator OR member visibility.
ALTER POLICY "Anyone can read pins" ON public.group_pinned_quizzes
  USING (EXISTS (SELECT 1 FROM public.trivia_groups g WHERE g.id = group_pinned_quizzes.group_id));
ALTER POLICY "Members can pin" ON public.group_pinned_quizzes TO authenticated
  WITH CHECK (auth.uid() = pinned_by AND public.is_group_member(group_id, auth.uid()));

-- Also close UPDATE retargeting; own historical rows remain readable/deletable.
ALTER POLICY "Users insert manual completions" ON public.assignment_completions
  WITH CHECK (auth.uid() = user_id AND source = 'manual' AND EXISTS (
    SELECT 1 FROM public.classroom_assignments ca
    WHERE ca.id = assignment_completions.assignment_id
      AND public.is_classroom_member(ca.classroom_id, auth.uid())
  ));
ALTER POLICY "Users update manual completions" ON public.assignment_completions
  USING (auth.uid() = user_id AND source = 'manual')
  WITH CHECK (auth.uid() = user_id AND source = 'manual' AND EXISTS (
    SELECT 1 FROM public.classroom_assignments ca
    WHERE ca.id = assignment_completions.assignment_id
      AND public.is_classroom_member(ca.classroom_id, auth.uid())
  ));

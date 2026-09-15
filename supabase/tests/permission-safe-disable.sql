-- Optional reviewed feature-disable rollback, NOT a forward migration.
-- Leaves INSERT policy hardening in place; never restore role-escalation holes.
DROP FUNCTION public.join_trivia_group_by_code(text);
DROP FUNCTION public.join_classroom_by_code(text);
DROP POLICY "Teachers can delete assignments" ON public.classroom_assignments;

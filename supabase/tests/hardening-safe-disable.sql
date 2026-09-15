-- Fail-closed feature disable, NOT a restoration of vulnerable policies.
-- Keep hardened helpers, private group SELECT and all stricter INSERT controls.
-- Revert frontend separately. Reapply 20260915133000 to re-enable safely.
ALTER POLICY "Anyone can read pins" ON public.group_pinned_quizzes USING (false);
ALTER POLICY "Members can pin" ON public.group_pinned_quizzes WITH CHECK (false);
ALTER POLICY "Users insert manual completions" ON public.assignment_completions WITH CHECK (false);
ALTER POLICY "Users update manual completions" ON public.assignment_completions USING (false) WITH CHECK (false);

-- Teachers see per-quiz progress only for current students and active, accessible
-- assignments in their own classroom. Never grant global student history.
-- Invoker subqueries retain existing parent RLS; no definer or write grants.
-- Private sharing must be authorized by the creator in THIS classroom, not an
-- unrelated assignment elsewhere. Public quizzes may be assigned by any teacher.
CREATE POLICY "Teachers read current assigned student progress"
ON public.study_progress FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.classroom_assignments ca
    JOIN public.classroom_members teacher
      ON teacher.classroom_id = ca.classroom_id
      AND teacher.user_id = (SELECT auth.uid())
      AND teacher.role = 'teacher'
    JOIN public.classroom_members student
      ON student.classroom_id = ca.classroom_id
      AND student.user_id = study_progress.user_id
      AND student.role = 'student'
    JOIN public.quizzes q ON q.id = ca.quiz_id
    WHERE ca.quiz_id = study_progress.quiz_id
      AND q.archived_at IS NULL
      AND (q.is_public = true OR ca.assigned_by = q.creator_id)
  )
);

-- Existing own-progress policies, table privileges and completion RPCs unchanged.
-- Revocation (assignment delete, member leave/kick/demotion, quiz archive or
-- private-sharing withdrawal) takes effect on subsequent statement snapshots.

-- Current members can study active private quizzes shared by the quiz creator.
-- Do not trust an arbitrary quiz UUID in an assignment as an owner's consent:
-- assignment INSERT verifies teacher membership, but not ownership of quiz_id.
-- This invoker/RLS-scoped subquery needs no SECURITY DEFINER or new grants.
CREATE POLICY "Members read creator-assigned active quizzes"
ON public.quizzes FOR SELECT TO authenticated
USING (
  archived_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.classroom_assignments ca
    JOIN public.classroom_members cm ON cm.classroom_id = ca.classroom_id
    WHERE ca.quiz_id = quizzes.id
      AND ca.assigned_by = quizzes.creator_id
      AND cm.user_id = (SELECT auth.uid())
  )
);

-- Study and solo need questions and correctness data, not only the parent row.
-- Parent RLS preserves owner (including archived) and active-public access.
CREATE POLICY "Questions read visible quiz"
ON public.questions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = questions.quiz_id));

CREATE POLICY "Answers read visible question"
ON public.answers FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.questions q WHERE q.id = answers.question_id));

-- Production also has legacy permissive USING(true) child SELECT policies.
-- A restrictive guard intersects ALL permissive paths, including those policies.
-- Apply to PUBLIC so anonymous direct child requests cannot bypass parent RLS.
CREATE POLICY "Questions require visible quiz"
ON public.questions AS RESTRICTIVE FOR SELECT TO PUBLIC
USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = questions.quiz_id));

CREATE POLICY "Answers require visible question"
ON public.answers AS RESTRICTIVE FOR SELECT TO PUBLIC
USING (EXISTS (SELECT 1 FROM public.questions q WHERE q.id = answers.question_id));

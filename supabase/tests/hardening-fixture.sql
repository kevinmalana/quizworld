-- LOCAL ONLY extension reproducing observed live adjacent policies.
CREATE TABLE public.group_pinned_quizzes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid REFERENCES public.trivia_groups ON DELETE CASCADE, quiz_id uuid NOT NULL, pinned_by uuid NOT NULL);
CREATE TABLE public.assignment_completions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), assignment_id uuid REFERENCES public.classroom_assignments ON DELETE CASCADE, user_id uuid NOT NULL, source text NOT NULL);
ALTER TABLE public.group_pinned_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_completions ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.group_pinned_quizzes,public.assignment_completions TO anon,authenticated;
CREATE POLICY "Anyone can read pins" ON public.group_pinned_quizzes FOR SELECT USING(true);
CREATE POLICY "Members can pin" ON public.group_pinned_quizzes FOR INSERT WITH CHECK(auth.uid()=pinned_by);
CREATE POLICY "Pinners can remove" ON public.group_pinned_quizzes FOR DELETE USING(auth.uid()=pinned_by);
CREATE POLICY "Users read own completions" ON public.assignment_completions FOR SELECT TO authenticated USING(auth.uid()=user_id);
CREATE POLICY "Teachers read classroom completions" ON public.assignment_completions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.classroom_assignments ca JOIN public.classroom_members cm ON cm.classroom_id=ca.classroom_id WHERE ca.id=assignment_id AND cm.user_id=auth.uid() AND cm.role='teacher'));
CREATE POLICY "Users insert manual completions" ON public.assignment_completions FOR INSERT TO authenticated WITH CHECK(auth.uid()=user_id AND source='manual');
CREATE POLICY "Users update manual completions" ON public.assignment_completions FOR UPDATE TO authenticated USING(auth.uid()=user_id AND source='manual') WITH CHECK(auth.uid()=user_id AND source='manual');
CREATE POLICY "Users delete manual completions" ON public.assignment_completions FOR DELETE TO authenticated USING(auth.uid()=user_id AND source='manual');
INSERT INTO public.group_pinned_quizzes(group_id,quiz_id,pinned_by) SELECT id,'40000000-0000-0000-0000-000000000001',created_by FROM public.trivia_groups;

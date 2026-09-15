-- Disposable LOCAL reproduction of the relevant live RLS, not a production dump.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
CREATE TABLE public.quizzes(id uuid PRIMARY KEY, creator_id uuid NOT NULL, title text, is_public boolean, archived_at timestamptz);
CREATE TABLE public.questions(id uuid PRIMARY KEY, quiz_id uuid REFERENCES public.quizzes ON DELETE CASCADE, text text);
CREATE TABLE public.answers(id uuid PRIMARY KEY, question_id uuid REFERENCES public.questions ON DELETE CASCADE, text text, is_correct boolean);
CREATE TABLE public.classroom_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), classroom_id uuid, user_id uuid, role text CHECK(role IN ('student','teacher')), UNIQUE(classroom_id,user_id));
CREATE TABLE public.classroom_assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), classroom_id uuid, quiz_id uuid REFERENCES public.quizzes ON DELETE CASCADE, assigned_by uuid);
CREATE FUNCTION public.is_classroom_teacher(p_classroom_id uuid,p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT auth.uid() IS NOT NULL AND p_user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.classroom_members WHERE classroom_id=p_classroom_id AND user_id=auth.uid() AND role='teacher') $$;
CREATE POLICY classroom_members_select ON public.classroom_members FOR SELECT USING(user_id=auth.uid() OR public.is_classroom_teacher(classroom_id,auth.uid()));
CREATE POLICY classroom_members_delete ON public.classroom_members FOR DELETE USING(user_id=auth.uid() OR public.is_classroom_teacher(classroom_id,auth.uid()));
CREATE POLICY "Members can read assignments" ON public.classroom_assignments FOR SELECT USING(auth.uid() IN (SELECT user_id FROM public.classroom_members WHERE classroom_members.classroom_id=classroom_assignments.classroom_id));
CREATE POLICY "Teachers can create assignments" ON public.classroom_assignments FOR INSERT TO authenticated WITH CHECK(assigned_by=auth.uid() AND EXISTS(SELECT 1 FROM public.classroom_members cm WHERE cm.classroom_id=classroom_assignments.classroom_id AND cm.user_id=auth.uid() AND cm.role='teacher'));
CREATE POLICY "Teachers can delete assignments" ON public.classroom_assignments FOR DELETE TO authenticated USING(EXISTS(SELECT 1 FROM public.classroom_members cm WHERE cm.classroom_id=classroom_assignments.classroom_id AND cm.user_id=auth.uid() AND cm.role='teacher'));
CREATE POLICY "Owners can view their own private quizzes" ON public.quizzes FOR SELECT USING(auth.uid()=creator_id);
CREATE POLICY "Public quizzes are viewable by everyone" ON public.quizzes FOR SELECT USING(is_public=true AND archived_at IS NULL);
CREATE POLICY "Creator can update own quizzes" ON public.quizzes FOR UPDATE TO authenticated USING(creator_id=auth.uid());
CREATE POLICY "Creator can delete own quizzes" ON public.quizzes FOR DELETE TO authenticated USING(creator_id=auth.uid());
CREATE POLICY "Authenticated can insert quizzes" ON public.quizzes FOR INSERT TO authenticated WITH CHECK(creator_id=auth.uid());
CREATE POLICY "Questions read public or own" ON public.questions FOR SELECT USING(EXISTS(SELECT 1 FROM public.quizzes q WHERE q.id=questions.quiz_id AND (q.is_public OR q.creator_id=auth.uid())));
CREATE POLICY "Answers read public or own" ON public.answers FOR SELECT USING(EXISTS(SELECT 1 FROM public.questions qu JOIN public.quizzes q ON q.id=qu.quiz_id WHERE qu.id=answers.question_id AND (q.is_public OR q.creator_id=auth.uid())));
-- Legacy live permissive policies MUST be represented: new permissive policies alone cannot secure them.
CREATE POLICY "read questions" ON public.questions FOR SELECT USING(true);
CREATE POLICY "read answers" ON public.answers FOR SELECT USING(true);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['quizzes','questions','answers','classroom_assignments','classroom_members'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO anon,authenticated',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['questions','answers'] LOOP
    IF t='questions' THEN
      EXECUTE 'CREATE POLICY owner_write ON public.questions FOR ALL USING(EXISTS(SELECT 1 FROM public.quizzes q WHERE q.id=questions.quiz_id AND q.creator_id=auth.uid()))';
    ELSE
      EXECUTE 'CREATE POLICY owner_write ON public.answers FOR ALL USING(EXISTS(SELECT 1 FROM public.questions qu JOIN public.quizzes q ON q.id=qu.quiz_id WHERE qu.id=answers.question_id AND q.creator_id=auth.uid()))';
    END IF;
  END LOOP;
END $$;
-- Users: 1 creator/teacher, 2 student, 3 outsider, 4 other-class teacher, 5 co-teacher.
INSERT INTO public.classroom_members(classroom_id,user_id,role) VALUES
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','teacher'),
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','student'),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004','teacher'),
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000005','teacher');
INSERT INTO public.quizzes VALUES
('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Assigned private quiz',false,null),
('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Unassigned private quiz',false,null),
('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Public quiz',true,null),
('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','Archived assigned private',false,'2026-01-01'),
('20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','Archived public',true,'2026-01-01');
INSERT INTO public.questions SELECT ('30000000-0000-0000-0000-'||right(id::text,12))::uuid,id,'What is the capital of France?' FROM public.quizzes;
INSERT INTO public.answers SELECT ('40000000-0000-0000-0000-'||right(id::text,12))::uuid,id,'Paris',true FROM public.questions;
INSERT INTO public.classroom_assignments(classroom_id,quiz_id,assigned_by) SELECT '10000000-0000-0000-0000-000000000001',id,creator_id FROM public.quizzes WHERE right(id::text,1) IN ('1','4');
-- Rendering/query fields used by the real Study and solo components.
ALTER TABLE public.quizzes ADD COLUMN category text DEFAULT 'Geography', ADD COLUMN emoji text DEFAULT '🌍', ADD COLUMN slug text;
ALTER TABLE public.questions ADD COLUMN order_index integer DEFAULT 0, ADD COLUMN time_limit integer DEFAULT 20, ADD COLUMN points integer DEFAULT 1000;
UPDATE public.quizzes SET slug='fixture-'||right(id::text,1);

-- Already-applied assignment SELECT policy (fixture context only).
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

CREATE TABLE public.study_progress (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 quiz_id uuid NOT NULL REFERENCES public.quizzes ON DELETE CASCADE,
 questions_studied integer NOT NULL DEFAULT 0, correct integer NOT NULL DEFAULT 0,
 mastery integer NOT NULL DEFAULT 0, last_studied timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,quiz_id)
);
ALTER TABLE public.study_progress ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.study_progress TO anon,authenticated;
CREATE POLICY "Study progress is viewable by owner" ON public.study_progress FOR SELECT USING(auth.uid()=user_id);
CREATE POLICY "Users can update own study progress" ON public.study_progress FOR ALL USING(auth.uid()=user_id);
CREATE POLICY "insert own study progress" ON public.study_progress FOR INSERT WITH CHECK(auth.uid()=user_id);
CREATE POLICY "read own study progress" ON public.study_progress FOR SELECT USING(auth.uid()=user_id);
CREATE POLICY "update own study progress" ON public.study_progress FOR UPDATE USING(auth.uid()=user_id);
-- The student has learning history on every quiz, not just assigned material.
INSERT INTO public.study_progress(user_id,quiz_id,questions_studied,correct,mastery)
 SELECT '00000000-0000-0000-0000-000000000002',id,2,2,100 FROM public.quizzes;
INSERT INTO public.study_progress(user_id,quiz_id,questions_studied,correct,mastery) VALUES
 ('00000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000001',4,3,75),
 ('00000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001',4,1,25);

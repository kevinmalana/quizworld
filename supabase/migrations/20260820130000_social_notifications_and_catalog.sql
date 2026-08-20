-- Durable social notifications, verified assignment completion and canonical categories.
-- Additive/idempotent: safe to apply before the frontend that consumes it.

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('classroom_nudge')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  href TEXT NOT NULL,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.classroom_assignments(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_assignment
  ON public.notifications (assignment_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recipients read own notifications" ON public.notifications;
CREATE POLICY "Recipients read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Recipients mark own notifications read" ON public.notifications;
CREATE POLICY "Recipients mark own notifications read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Classroom teachers notify their students" ON public.notifications;
CREATE POLICY "Classroom teachers notify their students"
  ON public.notifications FOR INSERT
  WITH CHECK (
    auth.uid() = actor_id
    AND type = 'classroom_nudge'
    AND EXISTS (
      SELECT 1
      FROM public.classroom_members cm_teacher
      JOIN public.classroom_members cm_student
        ON cm_student.classroom_id = cm_teacher.classroom_id
      JOIN public.classroom_assignments ca
        ON ca.classroom_id = cm_teacher.classroom_id
      WHERE cm_teacher.classroom_id = notifications.classroom_id
        AND cm_teacher.user_id = auth.uid()
        AND cm_teacher.role = 'teacher'
        AND cm_student.user_id = notifications.user_id
        AND cm_student.role = 'student'
        AND ca.id = notifications.assignment_id
    )
  );

-- Existing manual completion remains available, but its provenance is explicit.
ALTER TABLE public.assignment_completions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'study_session'));

CREATE OR REPLACE FUNCTION public.complete_classroom_assignments_from_study()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.assignment_completions (assignment_id, user_id, source)
  SELECT ca.id, NEW.user_id, 'study_session'
  FROM public.classroom_assignments ca
  JOIN public.classroom_members cm
    ON cm.classroom_id = ca.classroom_id
   AND cm.user_id = NEW.user_id
   AND cm.role = 'student'
  WHERE ca.quiz_id = NEW.quiz_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.assignment_completions ac
      WHERE ac.assignment_id = ca.id
        AND ac.user_id = NEW.user_id
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS complete_classroom_assignments_from_study ON public.study_sessions;
CREATE TRIGGER complete_classroom_assignments_from_study
  AFTER INSERT ON public.study_sessions
  FOR EACH ROW
  WHEN (NEW.total > 0)
  EXECUTE FUNCTION public.complete_classroom_assignments_from_study();

-- Collapse legacy aliases into the labels used by current discovery navigation.
UPDATE public.quizzes
SET category = CASE category
  WHEN 'Mathematics' THEN 'Math'
  WHEN 'Animals' THEN 'Animals & Pets'
  WHEN 'Art' THEN 'Art & Literature'
  WHEN 'Books' THEN 'Art & Literature'
  WHEN 'Vehicles' THEN 'Cars & Automotive'
  WHEN 'Comics' THEN 'Comics & Anime'
  WHEN 'Anime & Manga' THEN 'Comics & Anime'
  WHEN 'Cartoons' THEN 'Comics & Anime'
  WHEN 'Mythology' THEN 'Mythology & Folklore'
  WHEN 'Politics' THEN 'Politics & Government'
  WHEN 'Computers' THEN 'Technology'
  WHEN 'Gadgets & Tech' THEN 'Technology'
  WHEN 'Television' THEN 'TV Shows'
  ELSE category
END
WHERE category IN (
  'Mathematics', 'Animals', 'Art', 'Books', 'Vehicles', 'Comics',
  'Anime & Manga', 'Cartoons', 'Mythology', 'Politics', 'Computers',
  'Gadgets & Tech', 'Television'
);

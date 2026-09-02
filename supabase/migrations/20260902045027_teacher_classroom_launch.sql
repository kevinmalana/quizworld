-- Atomically create a classroom and its initial teacher membership.
-- The authenticated caller is always the owner/teacher; callers cannot supply another user id.

CREATE OR REPLACE FUNCTION public.create_classroom_with_teacher(
  p_name TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS SETOF public.classrooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_classroom public.classrooms%ROWTYPE;
  v_name TEXT := BTRIM(COALESCE(p_name, ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF v_name = '' THEN
    RAISE EXCEPTION 'Classroom name is required.';
  END IF;

  IF CHAR_LENGTH(v_name) > 120 THEN
    RAISE EXCEPTION 'Classroom name must be 120 characters or fewer.';
  END IF;

  INSERT INTO public.classrooms (name, description, created_by)
  VALUES (v_name, NULLIF(BTRIM(COALESCE(p_description, '')), ''), v_user_id)
  RETURNING * INTO v_classroom;

  INSERT INTO public.classroom_members (classroom_id, user_id, role)
  VALUES (v_classroom.id, v_user_id, 'teacher');

  RETURN NEXT v_classroom;
END;
$$;

REVOKE ALL ON FUNCTION public.create_classroom_with_teacher(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_classroom_with_teacher(TEXT, TEXT) TO authenticated;

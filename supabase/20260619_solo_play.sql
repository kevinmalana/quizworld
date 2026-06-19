-- Run in Supabase SQL Editor
CREATE OR REPLACE FUNCTION public.increment_quiz_plays(quiz_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE quizzes SET plays = COALESCE(plays, 0) + 1 WHERE id = quiz_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_quiz_plays(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_quiz_plays(UUID) TO anon, authenticated;
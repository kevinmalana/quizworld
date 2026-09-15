-- Apply transactionally, after 20260915190000_assigned_private_quiz_access.sql.
-- Preserve the reviewed scoring/XP/idempotency implementation without copying it.
ALTER FUNCTION public.complete_study_session_atomic(UUID, UUID, TEXT, JSONB, INTEGER)
  RENAME TO complete_study_session_atomic_internal;
REVOKE ALL ON FUNCTION public.complete_study_session_atomic_internal(UUID, UUID, TEXT, JSONB, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.complete_study_session_atomic(
  p_quiz_id UUID,
  p_attempt_id UUID,
  p_study_mode TEXT,
  p_answers JSONB,
  p_duration_secs INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

  -- SECURITY DEFINER bypasses SELECT RLS: explicitly mirror quiz read authority.
  -- Owners retain archived access. All nonowners require an active quiz.
  -- Membership alone cannot authorize guessed-ID assignments by other creators.
  IF NOT EXISTS (
    SELECT 1
    FROM public.quizzes q
    WHERE q.id = p_quiz_id
      AND (
        q.creator_id = v_user_id
        OR (
          q.archived_at IS NULL
          AND (
            q.is_public = TRUE
            OR EXISTS (
              SELECT 1
              FROM public.classroom_assignments ca
              JOIN public.classroom_members cm ON cm.classroom_id = ca.classroom_id
              WHERE ca.quiz_id = q.id
                AND ca.assigned_by = q.creator_id
                AND cm.user_id = v_user_id
            )
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Quiz is not accessible.' USING ERRCODE = '42501';
  END IF;

  -- Guard replays too: revocation must take effect on the next request.
  RETURN public.complete_study_session_atomic_internal(
    p_quiz_id, p_attempt_id, p_study_mode, p_answers, p_duration_secs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_study_session_atomic(UUID, UUID, TEXT, JSONB, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_study_session_atomic(UUID, UUID, TEXT, JSONB, INTEGER)
  TO authenticated, service_role;

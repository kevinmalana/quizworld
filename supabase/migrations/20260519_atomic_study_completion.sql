-- Migration: Atomic Study Completion
-- Replaces 4 separate calls with single RPC

CREATE OR REPLACE FUNCTION complete_study_session_atomic(
  p_user_id UUID,
  p_quiz_id UUID,
  p_mode TEXT,
  p_correct_answers INTEGER,
  p_total_questions INTEGER,
  p_xp_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_study_session_id UUID;
  v_old_total_xp INTEGER;
  v_new_total_xp INTEGER;
  v_level_before INTEGER;
  v_level_after INTEGER;
  v_streak_before INTEGER;
  v_streak_after INTEGER;
BEGIN
  -- Get current state
  SELECT total_xp, study_streak INTO v_old_total_xp, v_streak_before
  FROM profiles WHERE id = p_user_id;

  v_level_before := FLOOR(1 + SQRT(1 + 4 * (COALESCE(v_old_total_xp, 0) / 100)) / 2);

  -- Insert study session
  INSERT INTO study_sessions (
    user_id,
    quiz_id,
    mode,
    correct_answers,
    total_questions,
    xp_earned,
    studied_at
  ) VALUES (
    p_user_id,
    p_quiz_id,
    p_mode,
    p_correct_answers,
    p_total_questions,
    p_xp_amount,
    NOW()
  )
  RETURNING id INTO v_study_session_id;

  -- Upsert study progress
  INSERT INTO study_progress (user_id, quiz_id, last_studied_at, study_count)
  VALUES (p_user_id, p_quiz_id, NOW(), 1)
  ON CONFLICT (user_id, quiz_id)
  DO UPDATE SET
    last_studied_at = NOW(),
    study_count = study_progress.study_count + 1;

  -- Update XP
  UPDATE profiles
  SET total_xp = COALESCE(total_xp, 0) + p_xp_amount
  WHERE id = p_user_id
  RETURNING total_xp INTO v_new_total_xp;

  v_level_after := FLOOR(1 + SQRT(1 + 4 * (v_new_total_xp / 100)) / 2);

  -- Update streak
  UPDATE profiles
  SET
    study_streak = CASE
      WHEN last_study_date IS NULL OR last_study_date < CURRENT_DATE - 1 THEN 1
      WHEN last_study_date = CURRENT_DATE - 1 THEN study_streak + 1
      ELSE study_streak
    END,
    longest_streak = GREATEST(longest_streak,
      CASE
        WHEN last_study_date IS NULL OR last_study_date < CURRENT_DATE - 1 THEN 1
        WHEN last_study_date = CURRENT_DATE - 1 THEN study_streak + 1
        ELSE study_streak
      END
    ),
    last_study_date = CURRENT_DATE
  WHERE id = p_user_id
  RETURNING study_streak INTO v_streak_after;

  -- Check and grant achievements
  -- (Simplified - full version would check all achievement conditions)
  PERFORM check_and_grant_achievements(p_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_study_session_id,
    'xp_earned', p_xp_amount,
    'total_xp', v_new_total_xp,
    'level_before', v_level_before,
    'level_after', v_level_after,
    'leveled_up', v_level_after > v_level_before,
    'streak_before', v_streak_before,
    'streak_after', v_streak_after
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION complete_study_session_atomic TO authenticated;

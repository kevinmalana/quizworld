import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const migrations = new URL("../supabase/migrations/", import.meta.url);
const compatibilityName = "20260820140000_quizworld_recovery_compatibility.sql";
const lockdownName = "20260820150000_quizworld_recovery_lockdown.sql";
const classroomLaunchName = "20260902045027_teacher_classroom_launch.sql";
const compatibility = readFileSync(new URL(compatibilityName, migrations), "utf8");
const lockdown = readFileSync(new URL(lockdownName, migrations), "utf8");
const classroomLaunch = existsSync(new URL(classroomLaunchName, migrations))
  ? readFileSync(new URL(classroomLaunchName, migrations), "utf8")
  : "";

test("recovery uses ordered unique migrations and has no paste bundle", () => {
  const recoveryFiles = readdirSync(migrations).filter((name) => name.includes("20260820"));
  assert.deepEqual(recoveryFiles, [compatibilityName, lockdownName]);
  assert.equal(existsSync(new URL("../supabase/manual/20260820_quizworld_recovery_bundle.sql", import.meta.url)), false);
});

test("classroom creation atomically creates the teacher membership", () => {
  assert.match(classroomLaunch, /CREATE OR REPLACE FUNCTION public\.create_classroom_with_teacher/i);
  assert.match(classroomLaunch, /v_user_id UUID := auth\.uid\(\)/i);
  assert.match(classroomLaunch, /INSERT INTO public\.classrooms[\s\S]*RETURNING \* INTO v_classroom/i);
  assert.match(classroomLaunch, /INSERT INTO public\.classroom_members \(classroom_id, user_id, role\)[\s\S]*'teacher'/i);
  assert.match(classroomLaunch, /SECURITY DEFINER[\s\S]*SET search_path = ''/i);
  assert.match(classroomLaunch, /GRANT EXECUTE ON FUNCTION public\.create_classroom_with_teacher\(TEXT, TEXT\) TO authenticated/i);
});

test("presentation activity is scoped to immutable runs without deleting history", () => {
  assert.match(compatibility, /DROP CONSTRAINT IF EXISTS presentation_live_sessions_presentation_id_key/i);
  assert.match(compatibility, /ADD COLUMN IF NOT EXISTS state JSONB NOT NULL DEFAULT '\{\}'::JSONB/i);
  assert.match(compatibility, /uq_presentation_live_sessions_one_live[\s\S]*WHERE status = 'live'/i);
  for (const table of ["presentation_participants", "slide_responses", "qna_questions", "qna_question_upvotes"]) {
    assert.match(compatibility, new RegExp(`ALTER TABLE public\\.${table}[\\s\\S]*ADD COLUMN IF NOT EXISTS run_id UUID`, "i"));
  }
  assert.match(compatibility, /CREATE TABLE IF NOT EXISTS public\.qna_questions/i);
  assert.match(compatibility, /CREATE TABLE IF NOT EXISTS public\.qna_question_upvotes/i);
  assert.match(compatibility, /UPDATE public\.slide_responses sr[\s\S]*ORDER BY pls\.started_at DESC/i);
  assert.match(compatibility, /CREATE OR REPLACE FUNCTION public\.start_presentation_run/i);
  assert.match(compatibility, /CREATE OR REPLACE FUNCTION public\.finish_presentation_run/i);
  assert.match(compatibility, /uq_slide_responses_run_participant/i);
  assert.match(compatibility, /CREATE OR REPLACE FUNCTION public\.upvote_presentation_qna/i);
  assert.match(compatibility, /ON CONFLICT \(question_id, participant_id\) DO NOTHING/i);
  assert.doesNotMatch(compatibility, /DELETE\s+FROM\s+public\.(presentation_live_sessions|presentation_participants|slide_responses|qna_questions|qna_question_upvotes)/i);
});

test("notifications are recipient-readable but writable only through authenticated RPCs", () => {
  assert.match(compatibility, /CREATE TABLE IF NOT EXISTS public\.notifications/i);
  assert.match(compatibility, /CREATE OR REPLACE FUNCTION public\.send_classroom_nudges/i);
  assert.match(compatibility, /cm_teacher\.role = 'teacher'/i);
  assert.match(compatibility, /CREATE OR REPLACE FUNCTION public\.mark_notifications_read/i);
  assert.match(compatibility, /CREATE POLICY "Recipients read own notifications"[\s\S]*auth\.uid\(\) = user_id/i);
  assert.match(compatibility, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.notifications FROM anon, authenticated/i);
  assert.match(compatibility, /GRANT EXECUTE ON FUNCTION public\.send_classroom_nudges\(UUID, UUID\) TO authenticated/i);
});

test("atomic study completion derives identity and score from validated answer ids", () => {
  assert.match(compatibility, /CREATE OR REPLACE FUNCTION public\.complete_study_session_atomic\([\s\S]*p_quiz_id UUID,\s*p_attempt_id UUID,\s*p_study_mode TEXT,\s*p_answers JSONB/i);
  assert.match(compatibility, /uq_study_sessions_user_attempt/i);
  assert.match(compatibility, /idempotent_replay/i);
  assert.match(compatibility, /v_user_id UUID := auth\.uid\(\)/i);
  assert.match(compatibility, /jsonb_array_length\(p_answers\)/i);
  assert.match(compatibility, /Every quiz question must be answered exactly once/i);
  assert.match(compatibility, /Submitted answer does not belong to the quiz question/i);
  assert.match(compatibility, /COUNT\(\*\) FILTER \(WHERE a\.is_correct = TRUE\)/i);
  assert.match(compatibility, /v_correct \* v_xp_per_correct \+ 50 \+ CASE WHEN v_correct = v_total THEN 100 ELSE 0 END/i);
  assert.match(compatibility, /INSERT INTO public\.study_sessions \(user_id, quiz_id, attempt_id, xp_earned, correct, total, study_mode, duration_secs\)/i);
  assert.match(compatibility, /INSERT INTO public\.study_progress \(user_id, quiz_id, questions_studied, correct, mastery, last_studied\)/i);
  assert.match(compatibility, /INSERT INTO public\.assignment_completions \(assignment_id, user_id, source\)/i);
  assert.match(lockdown, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.study_sessions, public\.study_progress[\s\S]*FROM PUBLIC, anon, authenticated/i);
  assert.match(lockdown, /DROP POLICY IF EXISTS "Users can insert own sessions"/i);
  assert.match(lockdown, /DROP POLICY IF EXISTS "Users insert own study progress"/i);
  assert.match(compatibility, /CREATE POLICY "Users insert manual completions"[\s\S]*source = 'manual'/i);
  assert.match(compatibility, /CREATE POLICY "Teachers read classroom completions"[\s\S]*cm\.role = 'teacher'/i);
  assert.doesNotMatch(compatibility, /CREATE TRIGGER[\s\S]*study_sessions/i);
  assert.doesNotMatch(compatibility, /p_user_id|p_xp_amount|p_correct|p_total|total_questions|correct_answers|studied_at/i);
});

test("legacy XP helpers remain available only during compatibility and are removed at lockdown", () => {
  assert.match(compatibility, /GRANT EXECUTE ON FUNCTION public\.increment_xp\(UUID, INTEGER\) TO authenticated, service_role/i);
  assert.match(compatibility, /GRANT EXECUTE ON FUNCTION public\.update_study_streak\(UUID\) TO authenticated, service_role/i);
  assert.match(lockdown, /REVOKE ALL ON FUNCTION public\.increment_xp\(UUID, INTEGER\) FROM PUBLIC, anon, authenticated/i);
  assert.match(lockdown, /REVOKE ALL ON FUNCTION public\.update_study_streak\(UUID\) FROM PUBLIC, anon, authenticated/i);
});

test("achievement XP is awarded atomically from server-verifiable eligibility", () => {
  assert.match(lockdown, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.user_achievements FROM PUBLIC, anon, authenticated/i);
  assert.match(compatibility, /REVOKE ALL ON FUNCTION public\.grant_achievement_if_eligible\(TEXT\) FROM PUBLIC, anon, authenticated/i);
  assert.match(lockdown, /GRANT EXECUTE ON FUNCTION public\.grant_achievement_if_eligible\(TEXT\) TO authenticated, service_role/i);
  assert.match(compatibility, /CREATE OR REPLACE FUNCTION public\.grant_achievement_if_eligible\(p_slug TEXT\)/i);
  assert.match(compatibility, /SELECT COALESCE\(xp_reward, 0\) INTO v_reward/i);
  assert.match(compatibility, /ON CONFLICT \(user_id, achievement_slug\) DO NOTHING/i);
  assert.match(compatibility, /SET total_xp = COALESCE\(total_xp, 0\) \+ v_reward/i);
  assert.doesNotMatch(compatibility, /grant_achievement_if_eligible\(p_slug TEXT, p_xp/i);
});

test("canonical category aliases and quiz tags are durable migration objects", () => {
  assert.match(compatibility, /CREATE TABLE IF NOT EXISTS public\.quiz_categories/i);
  assert.match(compatibility, /CREATE TABLE IF NOT EXISTS public\.quiz_category_aliases/i);
  assert.match(compatibility, /CREATE TABLE IF NOT EXISTS public\.quiz_tags/i);
  assert.match(compatibility, /CREATE TABLE IF NOT EXISTS public\.quiz_tag_links/i);
  assert.match(compatibility, /UPDATE public\.quizzes q[\s\S]*SET category = a\.category_name/i);
  assert.match(compatibility, /CREATE POLICY "Creators manage quiz tag links"/i);
});

test("draft and publish RPCs preserve video and shuffle fields with optimistic revision", () => {
  assert.match(compatibility, /ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0/i);
  assert.match(compatibility, /ADD COLUMN IF NOT EXISTS video_url TEXT/i);
  assert.match(compatibility, /ADD COLUMN IF NOT EXISTS shuffle_answers BOOLEAN NOT NULL DEFAULT false/i);
  assert.match(compatibility, /ADD COLUMN IF NOT EXISTS ai_metadata JSONB NOT NULL DEFAULT '\{\}'::JSONB/i);
  assert.match(compatibility, /ALTER TABLE public\.answers ADD COLUMN IF NOT EXISTS order_index INTEGER/i);
  assert.match(compatibility, /INSERT INTO public\.answers \(question_id,text,image_url,is_correct,order_index\)/i);
  assert.match(compatibility, /PERFORM 1 FROM public\.quizzes[\s\S]*FOR UPDATE/i);
  assert.match(compatibility, /CREATE OR REPLACE FUNCTION public\.save_presentation_v2/i);
  assert.match(compatibility, /content = COALESCE\(v_slide->'content', '\{\}'::JSONB\)/i);
  assert.doesNotMatch(compatibility, /v_slide->'content'[\s\S]{0,40}- '_imported'/i);
  assert.match(compatibility, /jsonb_agg\(to_jsonb\(s\) ORDER BY s\.order_index\)/i);
  assert.match(compatibility, /CREATE OR REPLACE FUNCTION public\.save_quiz_draft_v2/i);
  assert.match(compatibility, /p_expected_revision BIGINT/i);
  assert.match(compatibility, /'revision_conflict'/i);
  for (const fn of ["publish_quiz", "republish_quiz"]) {
    const start = compatibility.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}`);
    assert.notEqual(start, -1);
    const body = compatibility.slice(start, compatibility.indexOf("$$;", start) + 3);
    assert.match(body, /video_url/i);
    assert.match(body, /shuffle_answers/i);
    assert.match(body, /ai_metadata/i);
    assert.match(body, /question_type/i);
    assert.match(body, /explanation/i);
    assert.match(body, /image_url/i);
  }
});

test("game result persistence stays service-only and instance-idempotent", () => {
  assert.match(compatibility, /CREATE UNIQUE INDEX IF NOT EXISTS game_results_instance_key[\s\S]*game_instance_id/i);
  assert.match(compatibility, /CREATE OR REPLACE FUNCTION public\.record_game_result_v2/i);
  assert.match(compatibility, /ON CONFLICT \(game_instance_id\) DO NOTHING[\s\S]*RETURNING id INTO v_inserted_id/i);
  assert.match(compatibility, /IF v_inserted_id IS NULL THEN[\s\S]*WHERE game_instance_id = p_game_instance_id[\s\S]*ELSE[\s\S]*SET plays = COALESCE\(plays, 0\) \+ 1/i);
  assert.match(compatibility, /REVOKE ALL ON FUNCTION public\.record_game_result_v2\([\s\S]*FROM PUBLIC, anon, authenticated/i);
  assert.match(compatibility, /GRANT EXECUTE ON FUNCTION public\.record_game_result_v2\([\s\S]*TO service_role/i);
  assert.doesNotMatch(compatibility, /GRANT EXECUTE ON FUNCTION public\.record_game_result_v2\([\s\S]*TO (anon|authenticated)/i);
  assert.match(compatibility, /DROP POLICY IF EXISTS "Authenticated can read game_results"/i);
  assert.match(compatibility, /CREATE POLICY "Game results read own host results"[\s\S]*auth\.uid\(\) = host_id/i);
  assert.match(lockdown, /DROP POLICY IF EXISTS "Authenticated hosts can insert" ON public\.game_results/i);
  assert.match(lockdown, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.game_results FROM PUBLIC, anon, authenticated/i);
  assert.match(lockdown, /DROP INDEX IF EXISTS public\.game_results_pin_key/i);
});

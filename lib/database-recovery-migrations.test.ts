import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const migrations = new URL("../supabase/migrations/", import.meta.url);
const compatibilityName = "20260820140000_quizworld_recovery_compatibility.sql";
const lockdownName = "20260820150000_quizworld_recovery_lockdown.sql";
const compatibility = readFileSync(new URL(compatibilityName, migrations), "utf8");
const lockdown = readFileSync(new URL(lockdownName, migrations), "utf8");

test("recovery uses ordered unique migrations and has no paste bundle", () => {
  const recoveryFiles = readdirSync(migrations).filter((name) => name.includes("20260820"));
  assert.deepEqual(recoveryFiles, [compatibilityName, lockdownName]);
  assert.equal(existsSync(new URL("../supabase/manual/20260820_quizworld_recovery_bundle.sql", import.meta.url)), false);
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

test("atomic study completion derives identity, validates quiz count and computes XP", () => {
  assert.match(compatibility, /CREATE OR REPLACE FUNCTION public\.complete_study_session_atomic\([\s\S]*p_quiz_id UUID,\s*p_study_mode TEXT,\s*p_correct INTEGER,\s*p_total INTEGER/i);
  assert.match(compatibility, /v_user_id UUID := auth\.uid\(\)/i);
  assert.match(compatibility, /SELECT COUNT\(\*\)[\s\S]*FROM public\.questions[\s\S]*WHERE quiz_id = p_quiz_id/i);
  assert.match(compatibility, /IF p_total <> v_question_count/i);
  assert.match(compatibility, /CASE p_study_mode WHEN 'quickfire' THEN 45 ELSE 25 END/i);
  assert.match(compatibility, /p_correct \* v_xp_per_correct \+ 50 \+ CASE WHEN p_correct = p_total THEN 100 ELSE 0 END/i);
  assert.match(compatibility, /INSERT INTO public\.study_sessions \(user_id, quiz_id, xp_earned, correct, total, study_mode, duration_secs\)/i);
  assert.match(compatibility, /INSERT INTO public\.study_progress \(user_id, quiz_id, questions_studied, correct, mastery, last_studied\)/i);
  assert.match(compatibility, /INSERT INTO public\.assignment_completions \(assignment_id, user_id, source\)/i);
  assert.match(compatibility, /CREATE POLICY "Users insert manual completions"[\s\S]*source = 'manual'/i);
  assert.match(compatibility, /CREATE POLICY "Teachers read classroom completions"[\s\S]*cm\.role = 'teacher'/i);
  assert.doesNotMatch(compatibility, /CREATE TRIGGER[\s\S]*study_sessions/i);
  assert.doesNotMatch(compatibility, /p_user_id|p_xp_amount|total_questions|correct_answers|studied_at/i);
});

test("legacy XP helpers cannot target another user and lockdown removes direct use", () => {
  assert.match(compatibility, /auth\.uid\(\) IS DISTINCT FROM user_uuid[\s\S]*RAISE EXCEPTION 'Cannot update another user\.'/i);
  assert.match(lockdown, /REVOKE ALL ON FUNCTION public\.increment_xp\(UUID, INTEGER\) FROM PUBLIC, anon, authenticated/i);
  assert.match(lockdown, /REVOKE ALL ON FUNCTION public\.update_study_streak\(UUID\) FROM PUBLIC, anon, authenticated/i);
});

test("draft and publish RPCs preserve video and shuffle fields with optimistic revision", () => {
  assert.match(compatibility, /ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0/i);
  assert.match(compatibility, /ADD COLUMN IF NOT EXISTS video_url TEXT/i);
  assert.match(compatibility, /ADD COLUMN IF NOT EXISTS shuffle_answers BOOLEAN NOT NULL DEFAULT false/i);
  assert.match(compatibility, /ALTER TABLE public\.answers ADD COLUMN IF NOT EXISTS order_index INTEGER/i);
  assert.match(compatibility, /INSERT INTO public\.answers \(question_id,text,image_url,is_correct,order_index\)/i);
  assert.match(compatibility, /PERFORM 1 FROM public\.quizzes[\s\S]*FOR UPDATE/i);
  assert.match(compatibility, /CREATE OR REPLACE FUNCTION public\.save_quiz_draft_v2/i);
  assert.match(compatibility, /p_expected_revision BIGINT/i);
  assert.match(compatibility, /'revision_conflict'/i);
  for (const fn of ["publish_quiz", "republish_quiz"]) {
    const start = compatibility.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}`);
    assert.notEqual(start, -1);
    const body = compatibility.slice(start, compatibility.indexOf("$$;", start) + 3);
    assert.match(body, /video_url/i);
    assert.match(body, /shuffle_answers/i);
    assert.match(body, /question_type/i);
    assert.match(body, /explanation/i);
    assert.match(body, /image_url/i);
  }
});

test("game result persistence stays service-only and pin-idempotent", () => {
  assert.match(compatibility, /CREATE UNIQUE INDEX IF NOT EXISTS game_results_pin_key ON public\.game_results \(pin\)/i);
  assert.match(compatibility, /ON CONFLICT \(pin\) DO UPDATE/i);
  assert.match(compatibility, /REVOKE ALL ON FUNCTION public\.record_game_result\([\s\S]*FROM PUBLIC, anon, authenticated/i);
  assert.match(compatibility, /GRANT EXECUTE ON FUNCTION public\.record_game_result\([\s\S]*TO service_role/i);
  assert.doesNotMatch(compatibility, /GRANT EXECUTE ON FUNCTION public\.record_game_result\([\s\S]*TO (anon|authenticated)/i);
  assert.match(lockdown, /DROP POLICY IF EXISTS "Authenticated hosts can insert" ON public\.game_results/i);
  assert.match(lockdown, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.game_results FROM PUBLIC, anon, authenticated/i);
});

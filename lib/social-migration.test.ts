import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20260820130000_social_notifications_and_catalog.sql", import.meta.url);

test("social migration persists recipient-owned notifications with teacher-only delivery", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.notifications/i);
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /cm_teacher\.role = 'teacher'/i);
  assert.match(sql, /CREATE TRIGGER complete_classroom_assignments_from_study/i);
  assert.match(sql, /WHEN \(NEW\.total_questions > 0\)/i);
  assert.doesNotMatch(sql, /NEW\.total\b/i);
});

test("social migration canonicalizes legacy category aliases without deleting quizzes", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /WHEN 'Mathematics' THEN 'Math'/i);
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+public\.quizzes/i);
});

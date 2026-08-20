import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260820_presentation_security_recovery.sql", import.meta.url),
  "utf8",
);

test("presentation security migration can be safely retried", () => {
  for (const policy of [
    "Responses no direct client access",
    "QnA no direct client access",
    "QnA upvotes no direct client access",
  ]) {
    const drop = `DROP POLICY IF EXISTS "${policy}"`;
    const create = `CREATE POLICY "${policy}"`;
    assert.ok(sql.includes(drop), `missing idempotent drop for ${policy}`);
    assert.ok(sql.indexOf(drop) < sql.indexOf(create), `drop must precede create for ${policy}`);
  }
});

test("presentation activity tables revoke direct browser roles", () => {
  assert.match(sql, /REVOKE ALL ON TABLE public\.slide_responses FROM anon, authenticated/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.qna_questions FROM anon, authenticated/);
});

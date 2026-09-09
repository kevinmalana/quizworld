import assert from "node:assert/strict";
import test from "node:test";
import { shouldApplyFallbackSnapshot } from "./session-normalizers";

const publicSnapshot = { updated_at: "2026-09-09T11:43:29.157967Z", status: "finished" };
const hostSnapshot = { ...publicSnapshot, correct_counts: { voter: 0 }, question_history: [] };

test("a delayed public fallback cannot replace a same-revision host join", () => {
  assert.equal(shouldApplyFallbackSnapshot(hostSnapshot, null, publicSnapshot), false);
});

test("a fresh disconnected fallback can remove unavailable private aggregates", () => {
  assert.equal(shouldApplyFallbackSnapshot(hostSnapshot, hostSnapshot, publicSnapshot), true);
});

test("a genuinely newer fallback is not discarded when a channel snapshot arrived in flight", () => {
  assert.equal(shouldApplyFallbackSnapshot(hostSnapshot, null, { ...publicSnapshot, updated_at: "2026-09-09T11:44:00Z" }), true);
});

test("an older fallback never wins over current state", () => {
  const older = { ...publicSnapshot, updated_at: "2026-09-09T11:40:00Z" };
  assert.equal(shouldApplyFallbackSnapshot(hostSnapshot, hostSnapshot, older), false);
});

import assert from "node:assert/strict";
import test from "node:test";

import { shouldApplySessionSnapshot } from "./session-normalizers";

test("session snapshots reject duplicate and older revisions", () => {
  const current = { updated_at: "2026-08-20T07:00:00.000Z" };

  assert.equal(shouldApplySessionSnapshot(current, { updated_at: current.updated_at }), false);
  assert.equal(
    shouldApplySessionSnapshot(current, { updated_at: "2026-08-20T06:59:59.999Z" }),
    false
  );
});

test("session snapshots accept newer revisions and unversioned recovery state", () => {
  const current = { updated_at: "2026-08-20T07:00:00.000Z" };

  assert.equal(
    shouldApplySessionSnapshot(current, { updated_at: "2026-08-20T07:00:00.001Z" }),
    true
  );
  assert.equal(shouldApplySessionSnapshot(null, { updated_at: current.updated_at }), true);
  assert.equal(shouldApplySessionSnapshot(current, {}), true);
  assert.equal(
    shouldApplySessionSnapshot(current, { updated_at: current.updated_at }, { allowEqual: true }),
    true
  );
});

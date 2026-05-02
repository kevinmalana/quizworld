import test from "node:test";
import assert from "node:assert/strict";

import {
  getStudyAnswerShortcutIndex,
  isEditableShortcutTarget,
} from "../lib/study-shortcuts.ts";

test("getStudyAnswerShortcutIndex maps number keys to visible answers", () => {
  assert.equal(getStudyAnswerShortcutIndex("1", 4), 0);
  assert.equal(getStudyAnswerShortcutIndex("4", 4), 3);
  assert.equal(getStudyAnswerShortcutIndex("5", 4), null);
});

test("getStudyAnswerShortcutIndex maps letter keys to visible answers", () => {
  assert.equal(getStudyAnswerShortcutIndex("a", 4), 0);
  assert.equal(getStudyAnswerShortcutIndex("D", 4), 3);
  assert.equal(getStudyAnswerShortcutIndex("e", 4), null);
});

test("isEditableShortcutTarget ignores typing surfaces", () => {
  const input = globalThis.document?.createElement("input") ?? null;
  assert.equal(isEditableShortcutTarget(input), Boolean(input));
  assert.equal(isEditableShortcutTarget(null), false);
});

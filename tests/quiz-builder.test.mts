import test from "node:test";
import assert from "node:assert/strict";

import {
  getAdjacentMoveTarget,
  moveItem,
} from "../lib/quiz-builder.ts";

test("getAdjacentMoveTarget moves up or down by one slot within bounds", () => {
  assert.equal(getAdjacentMoveTarget(2, "up", 5), 1);
  assert.equal(getAdjacentMoveTarget(2, "down", 5), 3);
});

test("getAdjacentMoveTarget returns the current index when already at an edge", () => {
  assert.equal(getAdjacentMoveTarget(0, "up", 4), 0);
  assert.equal(getAdjacentMoveTarget(3, "down", 4), 3);
});

test("moveItem reorders items to the requested target index", () => {
  assert.deepEqual(moveItem(["q1", "q2", "q3", "q4"], 1, 3), ["q1", "q3", "q4", "q2"]);
  assert.deepEqual(moveItem(["q1", "q2", "q3", "q4"], 3, 1), ["q1", "q4", "q2", "q3"]);
});

test("moveItem leaves the list untouched for invalid or no-op moves", () => {
  const original = ["q1", "q2", "q3"];
  assert.deepEqual(moveItem(original, 1, 1), original);
  assert.deepEqual(moveItem(original, -1, 1), original);
  assert.deepEqual(moveItem(original, 1, 8), original);
});

import test from "node:test";
import assert from "node:assert/strict";
import * as analytics from "./game-analytics";

test("finished accuracy consumes authoritative aggregates without recounting the final answer", () => {
  const getAccuracy = analytics.getGameAccuracy;
  assert.equal(typeof getAccuracy, "function");
  const snapshot = { status: "finished", correct_counts: { me: 1 }, scored_question_count: 1,
    current_answers: [{ player_id: "me", is_correct: true }], question_history: [{ responses: [{ player_id: "me", is_correct: true }] }] };
  assert.deepEqual(getAccuracy(snapshot), { counts: { me: 1 }, total: 1 });
  assert.deepEqual(getAccuracy({ status: "finished" }), { counts: {}, total: 0 });
});

test("poll results are neutral and unavailable role-scoped accuracy is not shown as zero", () => {
  const feedback = analytics.getAnswerFeedback;
  const label = analytics.formatAccuracy;
  assert.equal(typeof feedback, "function");
  assert.equal(typeof label, "function");
  assert.equal(feedback("poll", false), "Vote recorded — unscored poll");
  assert.equal(feedback("multiple_choice", true), "✅ Correct");
  assert.equal(feedback("multiple_choice", false), "❌ Incorrect");
  assert.equal(label(undefined, 1), "");
  assert.equal(label(0, 0), "No scored questions · ");
  assert.equal(label(1, 1), "1/1 ✓ · ");
});

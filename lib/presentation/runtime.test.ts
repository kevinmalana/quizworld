import assert from "node:assert/strict";
import test from "node:test";
import {
  activityMatchesSlide,
  normalizePresentationActivity,
  shouldShowPresentationResults,
  summarizePresentationActivity,
} from "./runtime";

test("hidden presentation results stay hidden for hosts and audience", () => {
  assert.equal(shouldShowPresentationResults(true), false);
  assert.equal(shouldShowPresentationResults(false), true);
});

test("participant activity ignores raw rows and consumes safe aggregates and own response", () => {
  const activity = normalizePresentationActivity({
    responses: [{ participant_id: "other", response_data: { answer: "secret" } }],
    response_count: 8,
    own_response: { submitted: true },
    aggregates: { poll_counts: { a: 5, b: 3 } },
    questions: [],
  }, false);
  assert.deepEqual(activity.responses, []);
  assert.equal(activity.responseCount, 8);
  assert.deepEqual(activity.ownResponse, { submitted: true });
  assert.deepEqual(activity.aggregates, { poll_counts: { a: 5, b: 3 } });
});

test("realtime activity is accepted only for the currently displayed slide", () => {
  assert.equal(activityMatchesSlide("slide-2", { slide_id: "slide-2" }), true);
  assert.equal(activityMatchesSlide("slide-2", { slide_id: "slide-1" }), false);
  assert.equal(activityMatchesSlide(undefined, { slide_id: "slide-1" }), false);
});

test("presentation activity summary derives poll, word-cloud, and scale results", () => {
  const summary = summarizePresentationActivity(
    { content: { options: [{ id: "a" }, { id: "b" }] } },
    [
      { response_data: { option_id: "a", words: "Blue blue", value: 4 } },
      { response_data: { option_id: "b", words: "Green", value: 8 } },
    ],
  );

  assert.deepEqual(summary.pollCounts, { a: 1, b: 1 });
  assert.deepEqual(summary.sortedWords, [["blue", 2], ["green", 1]]);
  assert.deepEqual(summary.scaleValues, [4, 8]);
  assert.equal(summary.scaleAvg, 6);
});

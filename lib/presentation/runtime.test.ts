import assert from "node:assert/strict";
import test from "node:test";
import {
  activityMatchesSlide,
  shouldShowPresentationResults,
  summarizePresentationActivity,
} from "./runtime";

test("hidden presentation results stay hidden for hosts and audience", () => {
  assert.equal(shouldShowPresentationResults(true), false);
  assert.equal(shouldShowPresentationResults(false), true);
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

import assert from "node:assert/strict";
import test from "node:test";

import { calculateStudyXp, shouldExpireQuickFireQuestion } from "./session";

test("QuickFire does not expire before the first question timer is initialized", () => {
  assert.equal(
    shouldExpireQuickFireQuestion({
      mode: "quickfire",
      hasQuestion: true,
      sessionComplete: false,
      advancing: false,
      timerPaused: false,
      timeLeft: null,
    }),
    false,
  );
});

test("QuickFire expires an initialized timer when it reaches zero", () => {
  assert.equal(
    shouldExpireQuickFireQuestion({
      mode: "quickfire",
      hasQuestion: true,
      sessionComplete: false,
      advancing: false,
      timerPaused: false,
      timeLeft: 0,
    }),
    true,
  );
});

test("completed study sessions always earn the completion bonus", () => {
  assert.deepEqual(calculateStudyXp({ mode: "flashcard", correct: 1, total: 2 }), {
    xpPerCorrect: 25,
    correctXp: 25,
    completionBonus: 50,
    perfectBonus: 0,
    totalXp: 75,
  });
});

test("perfect QuickFire sessions add the perfect-score bonus", () => {
  assert.deepEqual(calculateStudyXp({ mode: "quickfire", correct: 2, total: 2 }), {
    xpPerCorrect: 45,
    correctXp: 90,
    completionBonus: 50,
    perfectBonus: 100,
    totalXp: 240,
  });
});

import { test } from "node:test";
import * as assert from "node:assert/strict";

import { buildQuestionNavigation, getNextVisibleQuestionIndex } from "../lib/quiz-builder-navigation.js";

type QuestionNavigationEntry = {
  id: string;
  index: number;
  text: string;
  isComplete: boolean;
  errorCount: number;
  warningCount: number;
};

function entry(overrides: Partial<QuestionNavigationEntry>): QuestionNavigationEntry {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    index: overrides.index ?? 0,
    text: overrides.text ?? "",
    isComplete: overrides.isComplete ?? false,
    errorCount: overrides.errorCount ?? 0,
    warningCount: overrides.warningCount ?? 0,
  };
}

test("buildQuestionNavigation counts statuses and filters by search query", () => {
  const navigation = buildQuestionNavigation([
    entry({ index: 0, text: "Capital of France", isComplete: true }),
    entry({ index: 1, text: "", errorCount: 2 }),
    entry({ index: 2, text: "Longest river in Africa", isComplete: true, warningCount: 1 }),
  ], {
    filter: "all",
    query: "river",
  });

  assert.deepEqual(navigation.counts, {
    all: 3,
    needsAttention: 1,
    warnings: 1,
    ready: 1,
  });
  assert.deepEqual(
    navigation.visible.map((item) => item.index),
    [2],
  );
});

test("buildQuestionNavigation isolates questions that need attention", () => {
  const navigation = buildQuestionNavigation([
    entry({ index: 0, text: "Ready", isComplete: true }),
    entry({ index: 1, text: "Needs fixes", errorCount: 1 }),
    entry({ index: 2, text: "Needs timer review", isComplete: true, warningCount: 1 }),
  ], {
    filter: "needs-attention",
    query: "",
  });

  assert.deepEqual(
    navigation.visible.map((item) => item.index),
    [1],
  );
});

test("getNextVisibleQuestionIndex keeps the active question when still visible", () => {
  const visible = [entry({ index: 1 }), entry({ index: 3 })];

  assert.equal(getNextVisibleQuestionIndex(3, visible), 3);
});

test("getNextVisibleQuestionIndex falls back to the closest visible question", () => {
  const visible = [entry({ index: 1 }), entry({ index: 4 }), entry({ index: 7 })];

  assert.equal(getNextVisibleQuestionIndex(5, visible), 4);
  assert.equal(getNextVisibleQuestionIndex(0, visible), 1);
  assert.equal(getNextVisibleQuestionIndex(8, visible), 7);
  assert.equal(getNextVisibleQuestionIndex(2, []), null);
});

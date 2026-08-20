import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeCategory,
  categoryVariants,
  excludeFeaturedQuizzes,
  formatCatalogCount,
  mergeCatalogPage,
} from "./catalog-discovery";

test("category aliases resolve to one canonical discovery category", () => {
  assert.equal(canonicalizeCategory("Mathematics"), "Math");
  assert.equal(canonicalizeCategory(" television "), "TV Shows");
  assert.equal(canonicalizeCategory("Unknown Topic"), "Other");
  assert.deepEqual(categoryVariants("Math"), ["Math", "Mathematics"]);
});

test("catalog pages deduplicate quizzes by id while preserving first-seen order", () => {
  const merged = mergeCatalogPage(
    [{ id: "quiz-1", title: "First" }, { id: "quiz-2", title: "Second" }],
    [{ id: "quiz-2", title: "Duplicate" }, { id: "quiz-3", title: "Third" }]
  );

  assert.deepEqual(merged.map((quiz) => [quiz.id, quiz.title]), [
    ["quiz-1", "First"],
    ["quiz-2", "Second"],
    ["quiz-3", "Third"],
  ]);
});

test("featured Explore rows do not repeat in the main catalog grid", () => {
  const catalog = [{ id: "q1" }, { id: "q2" }, { id: "q3" }, { id: "q4" }];
  const result = excludeFeaturedQuizzes(catalog, [[{ id: "q1" }], [{ id: "q3" }, { id: "q1" }]]);
  assert.deepEqual(result.map((quiz) => quiz.id), ["q2", "q4"]);
});

test("catalog count copy distinguishes loaded rows from the exact total", () => {
  assert.equal(formatCatalogCount(24, 137, "public quiz"), "Showing 24 of 137 public quizzes");
  assert.equal(formatCatalogCount(1, 1, "result"), "Showing 1 result");
});

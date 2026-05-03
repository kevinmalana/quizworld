import test from "node:test";
import assert from "node:assert/strict";

import { filterHostQuizzes, getHostQuizQuestionCount } from "../lib/host-quiz-search.ts";

const quizzes = [
  { id: "geo", title: "Capital Cities", category: "Geography", emoji: "🌍", questions: [{}, {}, {}] },
  { id: "sci", title: "Lab Safety", category: "Science & Nature", emoji: "🔬", questions: [{}, {}] },
  { id: "hist", title: "Ancient Rome", category: "History", emoji: "🏛️", questions: [] },
];

test("filterHostQuizzes returns all quizzes for blank searches", () => {
  assert.deepEqual(filterHostQuizzes(quizzes, "   ").map((quiz) => quiz.id), ["geo", "sci", "hist"]);
});

test("filterHostQuizzes matches quiz titles and categories case-insensitively", () => {
  assert.deepEqual(filterHostQuizzes(quizzes, "capital").map((quiz) => quiz.id), ["geo"]);
  assert.deepEqual(filterHostQuizzes(quizzes, "SCIENCE").map((quiz) => quiz.id), ["sci"]);
});

test("filterHostQuizzes matches emoji and question-count labels", () => {
  assert.deepEqual(filterHostQuizzes(quizzes, "🏛️").map((quiz) => quiz.id), ["hist"]);
  assert.deepEqual(filterHostQuizzes(quizzes, "2 questions").map((quiz) => quiz.id), ["sci"]);
});

test("getHostQuizQuestionCount handles missing question arrays and count relations", () => {
  assert.equal(getHostQuizQuestionCount({ title: "Untitled", questions: null }), 0);
  assert.equal(getHostQuizQuestionCount({ title: "Untitled" }), 0);
  assert.equal(getHostQuizQuestionCount({ title: "Count relation", questions: [{ count: 12 }] }), 12);
});

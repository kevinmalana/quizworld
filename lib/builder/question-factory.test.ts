import assert from "node:assert/strict";
import test from "node:test";
import {
  canPublishQuiz,
  isQuestionComplete,
  questionsToPublishPayload,
} from "./question-factory";

const question = {
  id: "q1",
  text: "Which city is the capital of France?",
  type: "multiple_choice" as const,
  timeLimit: 20,
  points: 1000,
  answers: [
    { id: "a1", text: "Paris", isCorrect: true },
    { id: "a2", text: "Lyon", isCorrect: false },
    { id: "a3", text: "", isCorrect: false },
  ],
};

test("question validation rejects any blank configured answer", () => {
  assert.equal(isQuestionComplete(question), false);
  assert.equal(
    isQuestionComplete({
      ...question,
      answers: question.answers.map((answer, index) =>
        index === 2 ? { ...answer, text: "Marseille" } : answer,
      ),
    }),
    true,
  );
});

test("publish payload trims authored text", () => {
  const [payload] = questionsToPublishPayload([
    {
      ...question,
      text: "  Which city is the capital of France?  ",
      answers: [
        { id: "a1", text: " Paris ", isCorrect: true },
        { id: "a2", text: " Lyon ", isCorrect: false },
      ],
    },
  ]);

  assert.equal(payload.text, "Which city is the capital of France?");
  assert.deepEqual(payload.answers.map((answer) => answer.text), ["Paris", "Lyon"]);
});

test("quiz validation blocks publishing when any authored question is incomplete", () => {
  const complete = {
    ...question,
    answers: question.answers.map((answer, index) =>
      index === 2 ? { ...answer, text: "Marseille" } : answer,
    ),
  };
  assert.equal(canPublishQuiz("Capitals", [complete, question]), false);
  assert.equal(canPublishQuiz("Capitals", [complete]), true);
  assert.equal(canPublishQuiz("  ", [complete]), false);
});

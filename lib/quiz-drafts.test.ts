import assert from "node:assert/strict";
import test from "node:test";
import { questionsFromDraftRows, questionsFromPublishedQuiz } from "./quiz-drafts";

test("draft recovery preserves rich question fields and answer order", () => {
  const questions = questionsFromDraftRows(
    [
      {
        id: "q1",
        draft_id: "d1",
        text: "Question",
        image_url: "question.png",
        time_limit: 30,
        points: 2000,
        order_index: 0,
        question_type: "true_false",
        explanation: "Explanation",
      },
    ],
    [
      { id: "a2", question_id: "q1", text: "False", image_url: null, is_correct: false, order_index: 1 },
      { id: "a1", question_id: "q1", text: "True", image_url: "true.png", is_correct: true, order_index: 0 },
    ],
  );

  assert.deepEqual(questions, [
    {
      id: "q1",
      text: "Question",
      imageUrl: "question.png",
      type: "true_false",
      timeLimit: 30,
      points: 2000,
      explanation: "Explanation",
      answers: [
        { id: "a1", text: "True", imageUrl: "true.png", isCorrect: true },
        { id: "a2", text: "False", imageUrl: "", isCorrect: false },
      ],
    },
  ]);
});

test("published quiz recovery sorts answers by their persisted order", () => {
  const [question] = questionsFromPublishedQuiz({
    id: "quiz-1",
    title: "Quiz",
    category: "Trivia",
    emoji: null,
    color: null,
    is_public: true,
    questions: [
      {
        id: "q1",
        text: "Question",
        image_url: null,
        question_type: "multiple_choice",
        explanation: null,
        time_limit: 20,
        points: 1000,
        order_index: 0,
        answers: [
          { id: "a2", text: "Second", image_url: null, is_correct: false, order_index: 1 },
          { id: "a1", text: "First", image_url: null, is_correct: true, order_index: 0 },
        ],
      },
    ],
  });

  assert.deepEqual(question.answers.map((answer) => answer.text), ["First", "Second"]);
});

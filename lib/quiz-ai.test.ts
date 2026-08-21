import assert from "node:assert/strict";
import test from "node:test";
import {
  findUngroundedQuestionIndices,
  type AIQuizDraft,
} from "./quiz-ai";

function draftWithCitation(snippet: string): AIQuizDraft {
  return {
    title: "Space",
    summary: "A grounded quiz",
    questions: [
      {
        text: "Which planet is known as the Red Planet?",
        question_type: "multiple_choice",
        time_limit: 20,
        points: 1000,
        confidence: "high",
        difficulty: "easy",
        rationale: "The source names Mars.",
        explanation: "Mars appears red because of iron oxides.",
        answers: [
          { text: "Mars", is_correct: true },
          { text: "Venus", is_correct: false },
        ],
        citations: [{ source_label: "Article", snippet }],
      },
    ],
  };
}

test("source grounding accepts exact citations despite whitespace and case differences", () => {
  const draft = draftWithCitation("Mars is known as the Red Planet");
  const source = "Planets overview:\nMARS   is known as the red planet because iron minerals oxidize.";
  assert.deepEqual(findUngroundedQuestionIndices(draft.questions, source), []);
});

test("source grounding rejects missing and invented citations", () => {
  assert.deepEqual(
    findUngroundedQuestionIndices(draftWithCitation("Jupiter is the Red Planet").questions, "Mars is the Red Planet."),
    [0],
  );
  const noCitations = draftWithCitation("");
  noCitations.questions[0].citations = [];
  assert.deepEqual(findUngroundedQuestionIndices(noCitations.questions, "Mars is the Red Planet."), [0]);
});

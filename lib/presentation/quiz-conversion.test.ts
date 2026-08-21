import assert from "node:assert/strict";
import test from "node:test";

import { convertQuizToPresentation } from "./quiz-conversion";

test("converts quiz questions into an editable interactive deck", () => {
  const deck = convertQuizToPresentation({
    title: "Space Basics",
    category: "Science & Nature",
    questions: [
      {
        id: "q1",
        text: "Which is the largest planet?",
        question_type: "multiple_choice",
        time_limit: 20,
        points: 1000,
        answers: [
          { id: "a1", text: "Jupiter", is_correct: true },
          { id: "a2", text: "Mars", is_correct: false },
        ],
      },
      {
        id: "q2",
        text: "Which topic should we explore next?",
        question_type: "poll",
        answers: [
          { id: "a3", text: "Black holes", is_correct: false },
          { id: "a4", text: "Exoplanets", is_correct: false },
        ],
      },
    ],
  });

  assert.equal(deck.title, "Space Basics — interactive deck");
  assert.deepEqual(deck.slides.map((slide) => slide.slide_type), ["content", "quiz", "poll", "qna"]);
  assert.equal(deck.slides[1].content.answers?.[0].is_correct, true);
  assert.equal(deck.slides[2].content.options?.[1].text, "Exoplanets");
});

test("rejects conversion when no question has usable answers", () => {
  assert.throws(
    () => convertQuizToPresentation({ title: "Empty", questions: [{ id: "q", text: "Broken", answers: [] }] }),
    /usable questions/i,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import type { InteractiveOverlay, Slide } from "./types";
import { makeInteractiveOverlay, validatePresentationSlides } from "./editor";

function contentSlide(interactive: InteractiveOverlay): Slide {
  return {
    id: "slide-1",
    presentation_id: "deck-1",
    slide_type: "content",
    title: "Imported",
    content: { image_url: "https://example.test/slide.jpg", interactive },
    order_index: 0,
    settings: {},
  };
}

test("overlay polls and quizzes receive the same validation as standalone slides", () => {
  assert.equal(
    validatePresentationSlides([contentSlide({ type: "poll", question: "Choose", options: [{ id: "1", text: "Only" }] })]),
    "Slide 1: polls need at least two non-empty options.",
  );

  assert.equal(
    validatePresentationSlides([contentSlide({ type: "quiz", question: "Choose", answers: [
      { id: "1", text: "A", is_correct: false },
      { id: "2", text: "B", is_correct: false },
    ] })]),
    "Slide 1: choose a correct answer.",
  );
});

test("bulk conversion creates editable overlays that cannot pass validation while blank", () => {
  const overlay = makeInteractiveOverlay("poll");
  assert.equal(overlay.type, "poll");
  assert.equal(validatePresentationSlides([contentSlide(overlay)]), "Slide 1: add a poll question.");
});

test("valid Q&A overlays and standalone quiz questions pass", () => {
  const quiz: Slide = {
    ...contentSlide({ type: "qna" }),
    slide_type: "quiz",
    content: {
      question: "Which answer is correct?",
      answers: [
        { id: "1", text: "A", is_correct: true },
        { id: "2", text: "B", is_correct: false },
      ],
    },
  };

  assert.equal(validatePresentationSlides([contentSlide({ type: "qna" }), quiz]), null);
});

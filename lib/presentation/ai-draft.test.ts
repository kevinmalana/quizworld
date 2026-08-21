import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAIPresentationPrompt,
  normalizeAIPresentationRequest,
  validateAIPresentationDraft,
} from "./ai-draft";

test("validates a mixed interactive presentation draft", () => {
  const draft = validateAIPresentationDraft({
    title: "Solar System",
    summary: "An interactive introduction",
    slides: [
      { slide_type: "content", title: "Welcome", content: { text: "# Solar System" } },
      { slide_type: "poll", title: "Warm-up", content: { question: "Which planet interests you?", options: [{ id: "1", text: "Mars" }, { id: "2", text: "Jupiter" }] } },
      { slide_type: "quiz", title: "Check understanding", content: { question: "Which is the largest planet?", answers: [{ id: "1", text: "Jupiter", is_correct: true }, { id: "2", text: "Mars", is_correct: false }] } },
    ],
  });

  assert.equal(draft.title, "Solar System");
  assert.equal(draft.slides.length, 3);
  assert.equal(draft.slides[2].slide_type, "quiz");
});

test("rejects blank interactive slides", () => {
  assert.throws(
    () => validateAIPresentationDraft({ title: "Bad", slides: [{ slide_type: "poll", title: "Poll", content: { question: "", options: [] } }] }),
    /valid options/i,
  );
});

test("builds a source-grounded prompt for documents", () => {
  const prompt = buildAIPresentationPrompt({
    sourceMode: "document",
    sourceText: "A sufficiently long document about photosynthesis and plant biology.",
    sourceTitle: "Plant notes",
    audience: "Year 8 students",
    slideCount: 8,
    interactionDensity: "balanced",
  });

  assert.match(prompt, /only the supplied source/i);
  assert.match(prompt, /Year 8 students/);
  assert.match(prompt, /8 slides/);
});

test("normalizes topic requests and caps generated slide count", () => {
  const request = normalizeAIPresentationRequest({
    sourceMode: "topic",
    sourceText: "Practical ways to teach fractions",
    slideCount: 99,
    audience: "Primary teachers",
    interactionDensity: "high",
  });

  assert.equal(request.slideCount, 15);
  assert.equal(request.sourceMode, "topic");
  assert.equal(request.interactionDensity, "high");
});

test("rejects thin document sources instead of hallucinating a deck", () => {
  assert.throws(
    () => normalizeAIPresentationRequest({ sourceMode: "document", sourceText: "Too short" }),
    /more source material/i,
  );
});

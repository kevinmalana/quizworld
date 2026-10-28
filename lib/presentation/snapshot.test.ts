import test from "node:test";
import assert from "node:assert/strict";
import { applyPresentationSnapshot } from "./snapshot";

// One slide/run-identity rule shared by initial load, channel events and
// polling fallback (audit finding F2): drafts reset only on a genuine
// slide/run change, never on every repeated activity update.

const deck = [
  { id: "s1", order_index: 1 },
  { id: "s0", order_index: 0 },
  { id: "s2", order_index: 2 },
];

test("snapshot: initial application reports a slide change and sorts slides", () => {
  const result = applyPresentationSnapshot(
    { slides: [] as typeof deck, currentIndex: 0, runId: null },
    { run_id: "run-1", current_slide_index: 1, slides: deck },
  );
  assert.deepEqual(result.slides.map((s) => s.id), ["s0", "s1", "s2"]);
  assert.equal(result.currentIndex, 1);
  assert.equal(result.runId, "run-1");
  assert.equal(result.slideChanged, true);
});

test("snapshot: repeated update on the same slide and run is not a slide change", () => {
  const current = { slides: [{ id: "s0", order_index: 0 }], currentIndex: 0, runId: "run-1" };
  const result = applyPresentationSnapshot(current, {
    run_id: "run-1",
    current_slide_index: 0,
    slides: [{ id: "s0", order_index: 0 }],
    results_hidden: true,
  });
  assert.equal(result.slideChanged, false);
  assert.equal(result.resultsHidden, true);
  assert.equal(result.ended, false);
});

test("snapshot: moving to a different slide is a slide change even without a fresh slides array", () => {
  const current = { slides: [{ id: "s0", order_index: 0 }, { id: "s1", order_index: 1 }], currentIndex: 0, runId: "run-1" };
  const result = applyPresentationSnapshot(current, { run_id: "run-1", current_slide_index: 1 });
  assert.equal(result.slideChanged, true);
  assert.deepEqual(result.slides, current.slides);
});

test("snapshot: a new run id is a slide change even at the same index and slide", () => {
  const current = { slides: [{ id: "s0", order_index: 0 }], currentIndex: 0, runId: "run-1" };
  const result = applyPresentationSnapshot(current, { run_id: "run-2", current_slide_index: 0, slides: current.slides });
  assert.equal(result.runId, "run-2");
  assert.equal(result.slideChanged, true);
});

test("snapshot: finished status reports ended", () => {
  const current = { slides: [{ id: "s0", order_index: 0 }], currentIndex: 0, runId: "run-1" };
  const result = applyPresentationSnapshot(current, { status: "finished" });
  assert.equal(result.ended, true);
  assert.equal(applyPresentationSnapshot(current, { status: "live" }).ended, false);
});

test("snapshot: out-of-range index is clamped to the deck", () => {
  const current = { slides: [{ id: "s0", order_index: 0 }, { id: "s1", order_index: 1 }], currentIndex: 0, runId: "run-1" };
  assert.equal(applyPresentationSnapshot(current, { current_slide_index: 99 }).currentIndex, 1);
  assert.equal(applyPresentationSnapshot(current, { current_slide_index: -3 }).currentIndex, 0);
});

test("snapshot: absent fields fall back to current state", () => {
  const current = { slides: [{ id: "s0", order_index: 0 }], currentIndex: 0, runId: "run-1" };
  const result = applyPresentationSnapshot(current, {});
  assert.equal(result.runId, "run-1");
  assert.deepEqual(result.slides, current.slides);
  assert.equal(result.currentIndex, 0);
  assert.equal(result.slideChanged, false);
  assert.equal(result.resultsHidden, null);
  assert.equal(result.revealedAnswers, null);
});

test("snapshot: quiz reveals pass through when present", () => {
  const current = { slides: [{ id: "s0", order_index: 0 }], currentIndex: 0, runId: "run-1" };
  const reveals = { s0: ["a1"] };
  const result = applyPresentationSnapshot(current, { quiz_reveals: reveals });
  assert.equal(result.revealedAnswers, reveals);
});

test("snapshot: null or undefined snapshot keeps current state without a slide change", () => {
  const current = { slides: [{ id: "s0", order_index: 0 }], currentIndex: 0, runId: "run-1" };
  for (const empty of [null, undefined]) {
    const result = applyPresentationSnapshot(current, empty);
    assert.equal(result.slideChanged, false);
    assert.equal(result.runId, "run-1");
  }
});

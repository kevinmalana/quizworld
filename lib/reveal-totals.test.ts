import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { revealTotals } from "./game/reveal-totals";

// Shapes taken from Phoenix game.ex: in "reveal" every viewer gets per-option
// `count`; a player's current_answers contains only their own row.
const revealAnswers = [
  { id: "a", text: "Alpha", is_correct: true, count: 1 },
  { id: "b", text: "Beta", is_correct: false, count: 1 },
  { id: "c", text: "Gamma", is_correct: false, count: 0 },
];

test("a player sees the real class distribution from Phoenix's counts, not just their own row", () => {
  const own = [{ answer_id: "b", is_correct: false }];
  const totals = revealTotals(revealAnswers, own, false);
  assert.equal(totals.classWide, true);
  assert.deepEqual(totals.answerCounts.map((a) => a.count), [1, 1, 0]);
  assert.equal(totals.correct, 1);
  assert.equal(totals.total, 2);
});

test("the host gets the same totals as players", () => {
  const all = [{ answer_id: "a", is_correct: true }, { answer_id: "b", is_correct: false }];
  const host = revealTotals(revealAnswers, all, true);
  const player = revealTotals(revealAnswers, [{ answer_id: "b", is_correct: false }], false);
  assert.deepEqual([host.correct, host.total], [player.correct, player.total]);
});

test("without server counts a player is never shown totals built from their own row", () => {
  const noCounts = revealAnswers.map(({ count: _count, ...rest }) => rest);
  const totals = revealTotals(noCounts, [{ answer_id: "b", is_correct: false }], false);
  assert.equal(totals.classWide, false);
});

test("without server counts the host still counts every answer", () => {
  const noCounts = revealAnswers.map(({ count: _count, ...rest }) => rest);
  const all = [{ answer_id: "a", is_correct: true }, { answer_id: "a", is_correct: true }, { answer_id: "c", is_correct: false }];
  const totals = revealTotals(noCounts, all, true);
  assert.equal(totals.classWide, true);
  assert.deepEqual(totals.answerCounts.map((a) => a.count), [2, 0, 1]);
  assert.deepEqual([totals.correct, totals.total], [2, 3]);
});

test("Phoenix still strips counts only while a question is open", () => {
  const src = fs.readFileSync("services/quizworld_realtime/lib/quizworld_realtime/game.ex", "utf8");
  assert.match(src, /defp hide_live_answer_counts\(%\{status: "active"/);
});

test("the game page uses server totals for the reveal", () => {
  const src = fs.readFileSync("app/game/[pin]/page.tsx", "utf8");
  assert.match(src, /revealTotals\(currentQuestion\?\.answers, currentAnswers, isHost\)/);
  assert.match(src, /showCounts=\{reveal\.classWide\}/);
});

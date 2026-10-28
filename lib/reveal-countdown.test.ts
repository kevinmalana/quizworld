import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  AUTO_ADVANCE_MS,
  nextRevealStart,
  revealCountdownLabel,
  secondsUntilAdvance,
} from "./game/use-reveal-countdown";

const round = (status: string, questionIndex = 0, instanceId = "game-1") => ({ status, questionIndex, instanceId });

test("countdown matches Phoenix's auto-advance window", () => {
  const source = fs.readFileSync("services/quizworld_realtime/lib/quizworld_realtime/game_server.ex", "utf8");
  const ms = Number(source.match(/@auto_advance_ms\s+([\d_]+)/)?.[1].replace(/_/g, ""));
  assert.equal(ms, AUTO_ADVANCE_MS);
});

test("a reveal watched from the active round starts the countdown", () => {
  assert.equal(nextRevealStart(round("active"), round("reveal"), null, 1000), 1000);
  assert.equal(secondsUntilAdvance(1000, 1000), 15);
  assert.equal(secondsUntilAdvance(1000, 1000 + 5_200), 10);
});

test("later snapshots in the same reveal keep the original start", () => {
  assert.equal(nextRevealStart(round("reveal"), round("reveal"), 1000, 9000), 1000);
});

test("loading or reloading straight into a reveal shows no guessed countdown", () => {
  assert.equal(nextRevealStart(null, round("reveal"), null, 1000), null);
  assert.equal(secondsUntilAdvance(null, 1000), null);
  assert.equal(revealCountdownLabel(null, false), null);
});

test("a different round or game never inherits a countdown", () => {
  assert.equal(nextRevealStart(round("active", 0), round("reveal", 1), null, 1000), null);
  assert.equal(nextRevealStart(round("active", 0, "old"), round("reveal", 0, "new"), null, 1000), null);
  assert.equal(nextRevealStart(round("reveal"), round("active", 1), 1000, 2000), null);
});

test("labels explain what happens next, including the final question", () => {
  assert.equal(revealCountdownLabel(12, false), "Next question starts automatically in 12s");
  assert.equal(revealCountdownLabel(3, true), "Final results in 3s");
  assert.equal(revealCountdownLabel(0, false), "Starting the next question…");
  assert.equal(secondsUntilAdvance(0, 99_000), 0);
});

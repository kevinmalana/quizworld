import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnswerRevealList, RevealStatsLine } from "../components/game/AnswerRevealList";

Object.assign(globalThis, { React });

const answerCounts = [
  { id: "a", text: "Alpha", is_correct: true, count: 1 },
  { id: "b", text: "Beta", is_correct: false, count: 1 },
  { id: "c", text: "Gamma", is_correct: false, count: 0 },
];

test("host reveal keeps per-option answer counts and the correct marker", () => {
  const html = renderToStaticMarkup(
    React.createElement(AnswerRevealList, { answerCounts, showCounts: true, ownAnswerId: null })
  );
  assert.match(html, /1 answer/);
  assert.match(html, /0 answers/);
  assert.match(html, /✅/);
});

test("player reveal hides class-wide counts but keeps ✅ and marks their own answer", () => {
  const html = renderToStaticMarkup(
    React.createElement(AnswerRevealList, { answerCounts, showCounts: false, ownAnswerId: "b" })
  );
  assert.doesNotMatch(html, /\d+ answers?/);
  assert.match(html, /✅/);
  assert.match(html, /Your answer/);
});

test("player reveal omits the class-wide stats line; host keeps it; poll text shows for both", () => {
  const player = renderToStaticMarkup(
    React.createElement(RevealStatsLine, { isPoll: false, isHost: false, correctCount: 0, totalAnswered: 1 })
  );
  assert.equal(player, "");

  const host = renderToStaticMarkup(
    React.createElement(RevealStatsLine, { isPoll: false, isHost: true, correctCount: 1, totalAnswered: 2 })
  );
  assert.match(host, /1\/2 correct \(50%\)/);

  const pollPlayer = renderToStaticMarkup(
    React.createElement(RevealStatsLine, { isPoll: true, isHost: false, correctCount: 0, totalAnswered: 1 })
  );
  assert.match(pollPlayer, /Opinions have no right or wrong answer\./);
});

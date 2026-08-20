import assert from "node:assert/strict";
import test from "node:test";

import { buildScoreShareText } from "./score-sharing";

test("a player shares their own score instead of the winner's score", () => {
  const text = buildScoreShareText({
    gameMode: "classic",
    leaderboard: [
      { id: "winner", score: 2_000 },
      { id: "me", score: 750 },
    ],
    currentPlayerId: "me",
    teams: {},
    myTeamId: null,
  });

  assert.equal(text, "I scored 750 points on QuizWorld! Play at quizworld.xyz");
});

test("a host shares the winning score without claiming it personally", () => {
  const text = buildScoreShareText({
    gameMode: "classic",
    leaderboard: [{ id: "winner", score: 2_000 }],
    currentPlayerId: null,
    teams: {},
    myTeamId: null,
  });

  assert.equal(text, "The winning score was 2,000 points on QuizWorld! Play at quizworld.xyz");
});

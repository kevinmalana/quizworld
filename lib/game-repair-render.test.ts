import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ActiveHostDashboard } from "../components/game/ActiveHostDashboard";
import { GameFinishedPanel } from "../components/game/GameFinishedPanel";

Object.assign(globalThis, { React });

test("poll dashboard never labels opinion votes as zero accuracy", () => {
  const html = renderToStaticMarkup(React.createElement(ActiveHostDashboard, {
    players: [{ id: "me", nickname: "Me" }], currentAnswers: [{ player_id: "me", answer_id: "vote", is_correct: null }],
    currentQuestion: { id: "poll", text: "Vote", question_type: "poll", answers: [{ id: "vote", text: "Vote" }] }, timeLeft: 0, showResults: true,
  }));
  assert.doesNotMatch(html, /Accuracy/);
  assert.match(html, /Answered/);
});

test("finished player rendering shows own final accuracy without inventing other players' counts", () => {
  const html = renderToStaticMarkup(React.createElement(GameFinishedPanel, {
    notice: null, pin: "123456", leaderboard: [{ id: "me", nickname: "Me", score: 1000 }, { id: "other", nickname: "Other", score: 900 }],
    isHost: false, session: {}, playerAchievements: {}, playerCorrectCounts: { me: 1 }, totalQuestions: 1,
    aiSummary: null, aiSummaryLoading: false, onGenerateAiSummary() {}, currentPlayerId: "me",
  }));
  assert.match(html, /1\/1 ✓/);
  assert.doesNotMatch(html, /0\/1 ✓/);
  assert.doesNotMatch(html, /Get AI Insights/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { GameFinishedPanel } from "../components/game/GameFinishedPanel";
import { createGameInsightsHandler } from "./ai-game-insights";
import { normalizePhoenixSession, shouldApplySessionSnapshot, type GamePlayer } from "./game/session-normalizers";

Object.assign(globalThis, { React });
// Compile current subjects/dependencies even on a fresh checkout. No app starts.
execFileSync("mix", ["compile", "--warnings-as-errors"], {
  cwd: "services/quizworld_realtime", env: { PATH: process.env.PATH, HOME: process.env.HOME, LANG: "C.UTF-8", NODE_ENV: "test", MIX_ENV: "test" },
});
// Uses actual Phoenix Game/ResultSync without starting the application.
const fixtures = JSON.parse(execFileSync("elixir", ["-pa", "_build/test/lib/*/ebin", "test/support/report_fixture.exs"], {
  cwd: "services/quizworld_realtime", env: { PATH: process.env.PATH, HOME: process.env.HOME, LANG: "C.UTF-8", NODE_ENV: "test" }, encoding: "utf8",
}));

test("all modes: report rendering and CSV consume actual durable payloads neutrally", async () => {
  const reportPath = "../components/report/GameReport";
  const analyticsPath = "./report-analytics";
  const report = await import(reportPath).catch(() => null);
  const analytics = await import(analyticsPath).catch(() => null);
  assert.equal(typeof report?.GameReport, "function", "testable report view missing");
  const React = await import("react");
  Object.assign(globalThis, { React });
  const { renderToStaticMarkup } = await import("react-dom/server");
  const pollOnly = { results: fixtures[0].payload.p_results, finished_at: "2026-01-01T00:00:00Z" };
  const pollHtml = renderToStaticMarkup(React.createElement(report.GameReport, { result: pollOnly, pin: "123456", initialTab: "questions" }));
  assert.match(pollHtml, /Poll — unscored/, "poll report still applies learning judgments");
  assert.equal(typeof analytics?.buildReportCSV, "function", "shared export missing");
  for (const { mode, mixed, player_id, payload } of fixtures) {
    const result = { ...payload, results: payload.p_results, finished_at: "2026-01-01T00:00:00Z" };
    const breakdown = result.results.question_breakdown;
    const model = analytics.getReportAnalytics(breakdown);
    assert.equal(model.avgAccuracy, mixed ? 100 : null, mode);
    assert.deepEqual(model.playerAccuracy[player_id], mixed ? { correct: 1, total: 1 } : undefined);
    assert.equal(model.scored.length, mixed ? 1 : 0);
    const csv = analytics.buildReportCSV(breakdown);
    assert.match(csv, /"Preference\?","Vote","Unscored"/);
    assert.doesNotMatch(csv, /"Preference\?","Vote","No"/);
    if (mixed) assert.match(csv, /"Knowledge\?","Right","Yes"/);
    for (const initialTab of ["overview", "questions", "players"]) {
      const html = renderToStaticMarkup(React.createElement(report.GameReport, { result, pin: "123456", initialTab }));
      assert.doesNotMatch(html, /0\/1 correct|1\/2 correct/);
      if (initialTab === "questions") {
        assert.match(html, /Poll — unscored/);
        assert.doesNotMatch(html, /hard|Needs work/);
      }
      if (!mixed) assert.doesNotMatch(html, /Avg Accuracy|Question Difficulty|correct \(/);
    }
  }
});

test("historical missing markers remain unknown, never guessed from zero or positive correctness", async () => {
  const path = "./report-analytics";
  const analytics = await import(path).catch(() => null);
  assert.equal(typeof analytics?.getReportAnalytics, "function", "historical scoring policy missing");
  const rows = fixtures.find((f: { mixed: boolean }) => f.mixed).payload.p_results.question_breakdown;
  const legacy = rows.map((q: Record<string, unknown>) => ({ ...q, question_type: undefined, scored: undefined,
    // Old ResultSync encoded polls exactly like zero-correct scored questions.
    correct_count: q.correct_count ?? 0, accuracy_pct: q.accuracy_pct ?? 0, difficulty: q.difficulty ?? "hard",
  }));
  const model = analytics.getReportAnalytics(legacy);
  assert.equal(model.unknownCount, 2);
  assert.equal(model.avgAccuracy, null);
  assert.deepEqual(model.playerAccuracy, {});
  assert.equal(model.scored.length, 0);
  const csv = analytics.buildReportCSV(legacy);
  assert.match(csv, /Unknown \(legacy\)/);
  assert.doesNotMatch(csv, /"Yes"|"No"|"Unscored"/);
});

test("all modes: poll-only/mixed durable payloads retain explicit neutral scoring", () => {
  assert.equal(fixtures.length, 6);
  for (const { mode, mixed, payload } of fixtures) {
    const result = payload.p_results;
    const poll = result.question_breakdown[0];
    assert.equal(poll.question_type, "poll", `${mode}/${mixed}: missing durable type`);
    assert.equal(poll.scored, false);
    assert.equal(result.scored_question_count, mixed ? 1 : 0);
    assert.equal(poll.correct_count, null);
    assert.equal(poll.accuracy_pct, null);
    assert.equal(poll.difficulty, null);
    assert.equal(poll.points, 0);
    assert.equal(poll.correct_answer_text, null);
    assert.equal(poll.responses[0].is_correct, null);
    assert.equal(poll.distribution[0].is_correct, null);
    if (mixed) {
      assert.equal(result.question_breakdown[1].scored, true);
      assert.equal(result.question_breakdown[1].accuracy_pct, 100);
    }
  }
});

const request = (gameData: unknown) => new NextRequest("https://quizworld.local/api/ai-game-insights", {
  method: "POST", headers: { origin: "https://quizworld.local", "Content-Type": "application/json" }, body: JSON.stringify({ gameData }),
});

function renderPanel(session: Record<string, unknown>, isHost = true) {
  return renderToStaticMarkup(React.createElement(GameFinishedPanel, {
    notice: null, pin: "123456", leaderboard: session.players as GamePlayer[], isHost, session,
    playerAchievements: {}, playerCorrectCounts: (session.correct_counts ?? {}) as Record<string, number>,
    totalQuestions: session.scored_question_count as number, aiSummary: null, aiSummaryLoading: false, onGenerateAiSummary() {},
  }));
}

test("public fallback disables host AI action rather than offering fabricated zero accuracy", () => {
  for (const fixture of fixtures) {
    const html = renderPanel(normalizePhoenixSession(fixture.public));
    assert.match(html, /<button[^>]*disabled=""[^>]*>🧠 Get AI Insights/);
    assert.match(html, /Reconnect as host/);
  }
});

test("insights rejects unavailable or legacy completeness before any provider call", async () => {
  let calls = 0;
  const handler = createGameInsightsHandler({ guard: async () => null, complete: async () => {
    calls++;
    return Response.json({ choices: [{ message: { content: "fixture" } }] });
  } });
  const fabricated = { game_mode: "classic", total_players: 1, total_questions: 1, avg_score: 1000, avg_accuracy: 0,
    leaderboard: [{ score: 1000, correct: 0 }], question_stats: [] };
  for (const gameData of [fabricated, { ...fabricated, aggregates_available: false }, { ...fabricated, aggregates_available: true }]) {
    assert.equal((await handler(request(gameData))).status, 400);
  }
  assert.equal(calls, 0);
});

test("AI accepts complete early survival results without requiring unplayed future history", async () => {
  const path = "./game/game-insights-data";
  const { buildGameInsightsData } = await import(path);
  const fixture = fixtures.find((f: { mode: string; mixed: boolean }) => f.mode === "survival" && f.mixed);
  // Snapshot shape of an early survival finish: authority's final index stays
  // on the last revealed question, while the quiz still lists future questions.
  const early = normalizePhoenixSession({ ...fixture.host, quiz: { ...fixture.host.quiz,
    questions: [...fixture.host.quiz.questions, { id: "unplayed", order_index: 2 }],
  } });
  assert.notEqual(buildGameInsightsData(early, true), null);
});

test("AI rejects missing poll history even when scored count and participant counts look complete", async () => {
  const path = "./game/game-insights-data";
  const { buildGameInsightsData } = await import(path);
  for (const fixture of fixtures) {
    const incomplete = normalizePhoenixSession({ ...fixture.host,
      question_history: fixture.host.question_history.filter((q: { question_type: string }) => q.question_type !== "poll"),
    });
    assert.equal(buildGameInsightsData(incomplete, true), null, "missing unscored history must not masquerade as a complete host snapshot");
  }
});

test("all modes: finished host -> public fallback -> rejected attempt -> authenticated snapshot reconnect", async () => {
  const path = "./game/game-insights-data";
  const analytics = await import(path).catch(() => null);
  assert.equal(typeof analytics?.buildGameInsightsData, "function", "missing fail-closed summary builder");
  let calls = 0;
  const prompts: Record<string, unknown>[] = [];
  const handler = createGameInsightsHandler({ guard: async () => null, complete: async (payload) => {
    calls++;
    const messages = payload.messages as { content: string }[];
    prompts.push(JSON.parse(messages[1].content));
    assert.doesNotMatch(messages[1].content, /Voter|Non-voter|player_id|nickname|avatar|team_assignments/);
    return Response.json({ choices: [{ message: { content: "• Fixture only" } }] });
  } });
  for (const fixture of fixtures) {
    let session = normalizePhoenixSession(fixture.host);
    assert.notEqual(analytics.buildGameInsightsData(session, true), null);
    assert.doesNotMatch(renderPanel(session), /disabled=""/);
    assert.equal(analytics.buildGameInsightsData(session, false), null);
    assert.equal(analytics.buildGameInsightsData({ ...session, correct_counts: {} }, true), null);
    assert.equal(analytics.buildGameInsightsData({ ...session, scored_question_count: undefined }, true), null);
    assert.equal(analytics.buildGameInsightsData(normalizePhoenixSession(fixture.player), true), null);
    assert.equal(fixture.public.correct_counts, undefined);
    assert.equal(fixture.public.question_history, undefined);
    assert.equal(fixture.player.question_history, undefined);
    assert.equal(Object.keys(fixture.player.correct_counts).length, 1);
    const fallback = normalizePhoenixSession(fixture.public);
    assert.equal(shouldApplySessionSnapshot(session, fallback, { allowEqual: true }), true);
    session = fallback;
    const before = calls;
    const unavailable = analytics.buildGameInsightsData(session, true);
    assert.equal(unavailable, null);
    assert.equal((await handler(request(unavailable))).status, 400);
    assert.equal(calls, before);
    assert.equal(shouldApplySessionSnapshot(session, fixture.host, { allowEqual: true }), true);
    session = normalizePhoenixSession(fixture.host);
    const restored = analytics.buildGameInsightsData(session, true);
    assert.equal((await handler(request(restored))).status, 200);
    const prompt = prompts.at(-1)!;
    if (fixture.mixed) {
      assert.equal(prompt.avg_accuracy, 50);
      assert.equal((prompt.top_scores as { correct: number }[]).reduce((s, p) => s + p.correct, 0), 1);
    } else {
      assert.equal(prompt.avg_accuracy, undefined);
      assert.ok((prompt.top_scores as Record<string, unknown>[]).every(p => p.correct === undefined));
    }
  }
  assert.equal(calls, 6);
});

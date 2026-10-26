import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { checkRateLimit } from "./rate-limit";

const summary = { aggregates_available: true, game_mode: "classic", total_players: 2, total_questions: 1, avg_score: 900, avg_accuracy: 100,
  leaderboard: [{ nickname: "PRIVATE CHILD", score: 1000, correct: 1 }], question_stats: [{ text: "Capital?", correct_pct: 100, avg_time: 1 }], eliminated: [], teams: [] };
const request = (gameData: unknown = summary, origin = "https://quizworld.local") => new NextRequest("https://quizworld.local/api/ai-game-insights", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ gameData }) });

// Fixture identities, quota service and AI response; real handler/body parser.
// Atomic counters, cross-route allowance and expiry are tested on PostgreSQL in
// supabase/tests/test_audit_data_guards.py (no provider calls).
test("insights rejects anonymous, cross-origin, malformed, oversized and over-limit requests before spending", async () => {
  const path = "./ai-game-insights";
  const ai = await import(path).catch(() => null);
  assert.equal(typeof ai?.createGameInsightsHandler, "function", "bounded authenticated insights handler missing");
  let calls = 0;
  let identity: string | null = null;
  const reservations = new Map<string, number>();
  const handler = ai.createGameInsightsHandler({
    guard: (req: NextRequest) => checkRateLimit(req, async () => identity, async (userId) => {
      const count = reservations.get(userId) ?? 0;
      if (count >= 10) return { allowed: false, reason: "route", limit: 10, retry_after: 60, reset_at: 1234567 };
      reservations.set(userId, count + 1);
      return { allowed: true };
    }),
    complete: async (payload: Record<string, unknown>, cap: number) => {
      calls++;
      assert.equal(cap, 800);
      assert.doesNotMatch(JSON.stringify(payload), /PRIVATE CHILD/);
      return new Response(JSON.stringify({ choices: [{ message: { content: "• Local fixture insight" } }] }));
    },
  });
  assert.equal((await handler(request())).status, 401);
  identity = "invalid-fixture";
  assert.equal((await handler(request(summary, "https://attacker.test"))).status, 403);
  for (const invalid of [null, [], {}, { ...summary, total_players: 201 }, { ...summary, avg_accuracy: -1 }, { ...summary, question_stats: [{ text: "x", correct_pct: "yes", avg_time: 0 }] }]) {
    assert.equal((await handler(request(invalid))).status, 400);
  }
  identity = "oversized-fixture";
  assert.equal((await handler(request({ ...summary, extra: "x".repeat(40000) }))).status, 413);
  assert.equal(calls, 0);
  identity = "valid-fixture";
  for (let i = 0; i < 10; i++) assert.equal((await handler(request())).status, 200);
  const limited = await handler(request());
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get("Retry-After"));
  assert.equal(calls, 10);
});

test("durable daily denial and storage outage prevent AI provider calls", async () => {
  const { createGameInsightsHandler } = await import("./ai-game-insights");
  let calls = 0;
  for (const unavailable of [false, true]) {
    const handler = createGameInsightsHandler({
      guard: req => checkRateLimit(req, async () => "fixture", async () => {
        if (unavailable) throw new Error("offline storage");
        return { allowed: false, reason: "daily", limit: 50, retry_after: 3600, reset_at: 1234567 };
      }),
      complete: async () => { calls++; throw new Error("must not spend"); },
    });
    assert.equal((await handler(request())).status, unavailable ? 503 : 429);
  }
  assert.equal(calls, 0);
});

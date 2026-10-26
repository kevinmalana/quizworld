import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { checkRateLimit } from "./rate-limit";

const request = () => new NextRequest("https://quizworld.local/api/ai-enrich");
const identity = async () => "00000000-0000-0000-0000-000000000001";

test("quota storage failure fails closed before any AI operation", async () => {
  const result = await checkRateLimit(request(), identity, async () => { throw new Error("storage unavailable"); });
  assert.equal(result?.status, 503);
  assert.equal(result?.headers.get("Retry-After"), "60");
});

test("durable quota is consulted every request with verified identity and route", async () => {
  const calls: unknown[] = [];
  const consume = async (...args: unknown[]) => { calls.push(args); return { allowed: true }; };
  assert.equal(await checkRateLimit(request(), identity, consume), null);
  assert.equal(await checkRateLimit(request(), identity, consume), null);
  assert.deepEqual(calls, [[await identity(), "/api/ai-enrich"], [await identity(), "/api/ai-enrich"]]);
});

test("durable daily and route denial responses preserve retry headers", async () => {
  for (const reason of ["daily", "route"]) {
    const result = await checkRateLimit(request(), identity, async () => ({ allowed: false, reason, retry_after: 42, limit: 50, reset_at: 1234567 }));
    assert.equal(result?.status, 429);
    assert.equal(result?.headers.get("Retry-After"), "42");
    assert.equal(result?.headers.get("X-RateLimit-Remaining"), "0");
  }
});

test("anonymous requests never touch storage", async () => {
  let called = false;
  const result = await checkRateLimit(request(), async () => null, async () => { called = true; return { allowed: true }; });
  assert.equal(result?.status, 401);
  assert.equal(called, false);
});

test("server quota adapter uses the service-only RPC and fails closed on RPC errors", async (t) => {
  const prior = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://quota-fixture.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "offline-service-fixture";
  t.after(() => {
    for (const [name, value] of [["NEXT_PUBLIC_SUPABASE_URL", prior.url], ["SUPABASE_SERVICE_ROLE_KEY", prior.key]]) {
      if (value === undefined) delete process.env[name!]; else process.env[name!] = value;
    }
  });
  let fail = false;
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, options?: RequestInit) => {
    calls++;
    assert.equal(String(input), "https://quota-fixture.invalid/rest/v1/rpc/consume_ai_request_quota");
    assert.equal(new Headers(options?.headers).get("authorization"), "Bearer offline-service-fixture");
    assert.deepEqual(JSON.parse(String(options?.body)), { p_user_id: await identity(), p_path: "/api/ai-enrich" });
    return new Response(JSON.stringify(fail ? { code: "PGRST202", message: "migration missing" } : { allowed: true }), {
      status: fail ? 404 : 200, headers: { "Content-Type": "application/json" },
    });
  });
  assert.equal(await checkRateLimit(request(), identity), null);
  fail = true;
  assert.equal((await checkRateLimit(request(), identity))?.status, 503);
  assert.equal(calls, 2);
});

test("missing service configuration and malformed storage decisions fail closed", async (t) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  t.after(() => { if (key !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = key; });
  assert.equal((await checkRateLimit(request(), identity))?.status, 503);
  for (const value of [null, {}, [], { allowed: "true" }, { allowed: false }, { allowed: false, reason: "route", retry_after: -1, limit: 20, reset_at: 1 }]) {
    assert.equal((await checkRateLimit(request(), identity, async () => value))?.status, 503);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { consumePostLoginRedirect, peekPostLoginRedirect, resolveLoginReturnParam, normalizePostLoginRedirect } from "./redirects";

// Regression for the operator return-path contract: unauthenticated /admin
// requests must be sent to /login using the same `next` parameter the login
// page and /auth/callback already consume (the old middleware emitted
// `redirect`, which login ignored — see audit F5, 2026-10-28).
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://quizworld-contract-test.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "contract-test-anon-key";

async function loadMiddleware() {
  const { NextRequest } = await import("next/server");
  const { middleware } = await import("../../middleware");
  return { NextRequest, middleware };
}

test("middleware redirects signed-out /admin to login with the shared next param", async () => {
  const { NextRequest, middleware } = await loadMiddleware();
  const response = await middleware(new NextRequest("https://quizworld.local/admin"));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://quizworld.local/login?next=%2Fadmin");
});

test("middleware keeps the full admin path as the return destination", async () => {
  const { NextRequest, middleware } = await loadMiddleware();
  const response = await middleware(new NextRequest("https://quizworld.local/admin/users"));
  assert.equal(response.headers.get("location"), "https://quizworld.local/login?next=%2Fadmin%2Fusers");
});

test("middleware query intent survives login and the callback safe-path contract", async () => {
  const { NextRequest, middleware } = await loadMiddleware();
  const response = await middleware(new NextRequest("https://quizworld.local/admin/users?tab=recent"));
  const loginUrl = new URL(response.headers.get("location")!);
  const requested = resolveLoginReturnParam(loginUrl.search);
  const storage = { getItem: () => null, removeItem: () => {}, setItem: () => {} };
  assert.equal(consumePostLoginRedirect(storage, requested), "/admin/users?tab=recent");
  const oauthNext = peekPostLoginRedirect(storage, requested);
  const callback = new URL(`/auth/callback?next=${encodeURIComponent(oauthNext)}`, loginUrl.origin);
  assert.equal(normalizePostLoginRedirect(callback.searchParams.get("next")), "/admin/users?tab=recent");
});

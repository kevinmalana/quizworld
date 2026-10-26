import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Limits live in consume_ai_request_quota, not in browser-supplied arguments.
// Every protected route awaits this guard before any conversion/provider call.
const PROTECTED_ROUTES = new Set([
  "/api/ai-source-draft", "/api/ai-presentation-draft", "/api/import-url",
  "/api/ai-enrich", "/api/present/import-pdf", "/api/present/import-deck",
  "/api/ai-game-insights",
]);

type QuotaConsumer = (userId: string, path: string) => Promise<unknown>;

async function consumeDurableQuota(userId: string, path: string): Promise<unknown> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Quota service not configured");
  // Server-only service credential. Identity is obtained using auth.getUser()
  // below, never from request JSON, a header or an unverified session object.
  const service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await service.rpc("consume_ai_request_quota", {
    p_user_id: userId, p_path: path,
  }).abortSignal(AbortSignal.timeout(5_000));
  if (error) throw new Error("Quota storage unavailable");
  return data;
}

async function resolveUserId(request: NextRequest): Promise<string | null> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    return error ? null : user?.id ?? null;
  } catch {
    return null;
  }
}

/** Atomic durable per-route limits plus a shared 50/24h per-account AI allowance.
 * Storage/migration/configuration failure denies spending; no process-local fallback.
 * This is an account quota, not a global provider billing cap.
 * Injectable identity/storage seams are used by offline tests only.
 */
export async function checkRateLimit(
  request: NextRequest,
  resolveIdentity: (request: NextRequest) => Promise<string | null> = resolveUserId,
  consumeQuota: QuotaConsumer = consumeDurableQuota,
): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname;
  if (!PROTECTED_ROUTES.has(path)) return null;
  const userId = await resolveIdentity(request);
  if (!userId) return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 });

  try {
    const decision = await consumeQuota(userId, path);
    if (!decision || typeof decision !== "object" || Array.isArray(decision)) throw new Error("Invalid quota decision");
    const row = decision as Record<string, unknown>;
    if (row.allowed === true) return null;
    if (row.allowed !== false || !["daily", "route"].includes(String(row.reason)) ||
      !Number.isSafeInteger(row.retry_after) || (row.retry_after as number) < 1 ||
      !Number.isSafeInteger(row.limit) || (row.limit as number) < 1 ||
      !Number.isSafeInteger(row.reset_at) || (row.reset_at as number) < 1) throw new Error("Invalid quota denial");
    return NextResponse.json({ error: row.reason === "daily"
      ? "Daily AI allowance reached. Try again later."
      : `Too many requests. Try again in ${row.retry_after}s.` }, {
      status: 429,
      headers: {
        "Retry-After": String(row.retry_after),
        "X-RateLimit-Limit": String(row.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(row.reset_at),
      },
    });
  } catch {
    return NextResponse.json({ error: "AI allowance verification unavailable. Try again later." }, {
      status: 503, headers: { "Retry-After": "60" },
    });
  }
}

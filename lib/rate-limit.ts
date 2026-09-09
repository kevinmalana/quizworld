import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Rate limiter for QuizWorld API routes.
 *
 * Strategy:
 * - Primary guard: require authentication (unauthenticated → 401)
 * - Secondary: per-user fixed window in-process store
 * - Limitation: resets on Vercel cold start; not a durable budget
 * - Upgrade path: verify a shared durable quota and provider hard spend cap before scaling
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const ROUTE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  "/api/ai-source-draft": { maxRequests: 15, windowMs: 60_000 },
  "/api/ai-presentation-draft": { maxRequests: 10, windowMs: 60_000 },
  "/api/import-url":       { maxRequests: 10, windowMs: 60_000 },
  "/api/ai-enrich":        { maxRequests: 20, windowMs: 60_000 },
  // 2026-08-13 — bounds file-conversion endpoints:
  // /api/present/import-pdf  : 10/min per user — single-classroom upload workload
  // /api/present/import-deck : 10/min per user — pptx conversion is CPU-bound (LibreOffice)
  "/api/present/import-pdf":  { maxRequests: 10, windowMs: 60_000 },
  "/api/present/import-deck": { maxRequests: 10, windowMs: 60_000 },
  // 2026-08-13 — AI insights was unprotected from authDoS /api/ai-game-insights: 10/min
  "/api/ai-game-insights": { maxRequests: 10, windowMs: 60_000 },
};

// ─── In-process store ─────────────────────────────────────────────────────────

type RateEntry = { count: number; resetAt: number };
const store = new Map<string, RateEntry>();
const dailyStore = new Map<string, RateEntry>();
const MAX_KEYS = 10_000;
const EVICT_OLDER_THAN_MS = 5 * 60_000;

function evictStale() {
  if (store.size < MAX_KEYS) return;
  const cutoff = Date.now() - EVICT_OLDER_THAN_MS;
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < cutoff) store.delete(key);
    if (store.size < MAX_KEYS * 0.8) break;
  }
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function resolveUserId(request: NextRequest): Promise<string | null> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function checkRateLimit(
  request: NextRequest,
  resolveIdentity: (request: NextRequest) => Promise<string | null> = resolveUserId,
): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname;
  const limit = ROUTE_LIMITS[path];
  if (!limit) return null;

  // 1. Require authentication
  const userId = await resolveIdentity(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to use AI features." },
      { status: 401 }
    );
  }

  // Shared per-account AI allowance. Process-local: not a durable billing budget.
  if (path.startsWith("/api/ai-")) {
    const now = Date.now();
    for (const [id, entry] of dailyStore) if (entry.resetAt <= now) dailyStore.delete(id);
    const entry = dailyStore.get(userId) ?? { count: 0, resetAt: now + 86_400_000 };
    if (entry.count >= 50 || (!dailyStore.has(userId) && dailyStore.size >= MAX_KEYS)) {
      return NextResponse.json({ error: "Daily AI allowance reached. Try again later." }, {
        status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))) },
      });
    }
    entry.count++;
    dailyStore.set(userId, entry);
  }

  // 2. Per-user fixed window
  const key = `${userId}:${path}`;
  const now = Date.now();
  evictStale();

  const entry = store.get(key);
  const remaining_header_base = { "X-RateLimit-Limit": String(limit.maxRequests) };

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + limit.windowMs });
    return null; // first request in window — allow
  }

  if (entry.count >= limit.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: `Too many requests. Try again in ${retryAfter}s.` },
      {
        status: 429,
        headers: {
          ...remaining_header_base,
          "Retry-After": String(retryAfter),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
        },
      }
    );
  }

  entry.count++;
  return null;
}

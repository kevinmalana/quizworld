import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Rate limiter for QuizWorld API routes.
 *
 * Strategy:
 * - Primary guard: require authentication (unauthenticated → 401)
 * - Secondary: per-user sliding window in-process store
 * - Limitation: resets on Vercel cold start (acceptable for current scale)
 * - Upgrade path: swap rateLimitStore for @upstash/ratelimit when multi-region needed
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const ROUTE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  "/api/ai-source-draft": { maxRequests: 15, windowMs: 60_000 },
  "/api/import-url":       { maxRequests: 10, windowMs: 60_000 },
  "/api/ai-enrich":        { maxRequests: 20, windowMs: 60_000 },
};

// ─── In-process store ─────────────────────────────────────────────────────────

type RateEntry = { count: number; resetAt: number };
const store = new Map<string, RateEntry>();
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

export async function checkRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname;
  const limit = ROUTE_LIMITS[path];
  if (!limit) return null;

  // 1. Require authentication
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to use AI features." },
      { status: 401 }
    );
  }

  // 2. Per-user sliding window
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

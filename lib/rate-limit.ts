import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Production rate limiting strategy:
// Primary: require authentication on AI endpoints (free users can't spam anonymously)
// Secondary: per-user sliding window using a lightweight in-memory store
// Note: for multi-instance deployments, replace with @upstash/ratelimit + Redis

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const MAX_RATE_LIMIT_KEYS = 10_000;

const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number; requireAuth: boolean }> = {
  "/api/ai-source-draft": { maxRequests: 15, windowMs: 60_000, requireAuth: true },
  "/api/import-url":       { maxRequests: 10, windowMs: 60_000, requireAuth: true },
  "/api/ai-enrich":        { maxRequests: 20, windowMs: 60_000, requireAuth: true },
};

async function getAuthUserId(request: NextRequest): Promise<string | null> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function checkRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname;
  const limit = RATE_LIMITS[path];
  if (!limit) return null;

  // Auth check — block unauthenticated requests on AI endpoints
  const userId = await getAuthUserId(request);
  if (limit.requireAuth && !userId) {
    return NextResponse.json(
      { error: "Authentication required to use AI features. Please sign in." },
      { status: 401 }
    );
  }

  // Per-user (or per-IP fallback) sliding window
  const identifier = userId ?? (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
  const key = `${identifier}:${path}`;
  const now = Date.now();

  // Evict oldest entries if store grows too large
  if (rateLimitStore.size > MAX_RATE_LIMIT_KEYS) {
    const cutoff = now - 300_000; // 5 min
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt < cutoff) rateLimitStore.delete(k);
    }
  }

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + limit.windowMs });
    return null;
  }

  if (entry.count >= limit.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${retryAfter}s.` },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(limit.maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
        },
      }
    );
  }

  entry.count++;
  return null;
}

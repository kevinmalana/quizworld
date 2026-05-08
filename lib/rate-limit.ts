import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiter (per-IP, sliding window)
// For production, use Redis-backed rate limiting (e.g., @upstash/ratelimit)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const MAX_RATE_LIMIT_KEYS = 10_000;

const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  "/api/ai-source-draft": { maxRequests: 10, windowMs: 60_000 }, // 10/min
  "/api/import-url": { maxRequests: 5, windowMs: 60_000 }, // 5/min
};

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function checkRateLimit(request: NextRequest): NextResponse | null {
  const path = request.nextUrl.pathname;
  const limit = RATE_LIMITS[path];
  if (!limit) return null;

  const ip = getClientIp(request);
  const key = `${ip}:${path}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    if (rateLimitStore.size > MAX_RATE_LIMIT_KEYS) {
      for (const [storedKey, storedEntry] of rateLimitStore) {
        if (now > storedEntry.resetAt || rateLimitStore.size > MAX_RATE_LIMIT_KEYS) {
          rateLimitStore.delete(storedKey);
        }
      }
    }

    rateLimitStore.set(key, { count: 1, resetAt: now + limit.windowMs });
    return null;
  }

  if (entry.count >= limit.maxRequests) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      }
    );
  }

  entry.count++;
  return null;
}

import { NextResponse } from "next/server";

/**
 * Narrow, service-side admin overview aggregates.
 *
 * The browser admin page reads tables under normal RLS (for example game
 * results are host-only), so its client-side totals cannot represent all-game
 * counts. This helper authorizes a real cookie user against the authoritative
 * `profiles.is_admin` row using the service role, then returns ONLY allowlisted
 * integer counts. It must never return rows, titles, answers, PINs or any
 * private answer/result payload, and it never weakens RLS for other callers.
 */

export const ALLOWED_COUNT_KEYS = [
  "profiles",
  "quizzes",
  "public_quizzes",
  "game_results",
  "game_sessions",
  "active_game_sessions",
  "total_plays",
] as const;

export type AdminOverviewCounts = Record<(typeof ALLOWED_COUNT_KEYS)[number], number | null>;

export type AdminOverviewDeps = {
  /** Resolve the real signed-in user from request cookies, or null. */
  resolveUserId: () => Promise<string | null>;
  /** Read the authoritative is_admin flag for the verified user id. */
  loadIsAdmin: (userId: string) => Promise<boolean>;
  /** Load the allowlisted counts. Missing/degraded counts are null. */
  loadCounts: () => Promise<AdminOverviewCounts>;
};

function emptyCounts(): AdminOverviewCounts {
  return { profiles: null, quizzes: null, public_quizzes: null, game_results: null, game_sessions: null, active_game_sessions: null, total_plays: null };
}

export async function handleAdminOverviewRequest(deps: AdminOverviewDeps): Promise<NextResponse> {
  let userId: string | null;
  try { userId = await deps.resolveUserId(); } catch {
    return NextResponse.json({ error: "Identity verification unavailable." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view admin overview." }, { status: 401 });
  }

  let isAdmin: boolean;
  try {
    isAdmin = await deps.loadIsAdmin(userId);
  } catch {
    // Authorization storage failure fails closed: never serve aggregates on an
    // unverified identity.
    return NextResponse.json({ error: "Admin authorization unavailable." }, { status: 503 });
  }
  if (isAdmin !== true) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let counts: AdminOverviewCounts;
  try {
    counts = await deps.loadCounts();
  } catch {
    counts = emptyCounts();
  }

  // Allowlist projection: only the known integer-or-null keys leave the server.
  const safeCounts = emptyCounts();
  for (const key of ALLOWED_COUNT_KEYS) {
    const value = counts?.[key];
    safeCounts[key] = Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : null;
  }
  return NextResponse.json({ counts: safeCounts }, { headers: { "Cache-Control": "private, no-store" } });
}

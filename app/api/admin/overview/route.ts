import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { handleAdminOverviewRequest, type AdminOverviewCounts } from "./aggregates";

export const dynamic = "force-dynamic";

// Server-only credential; timed HEAD queries never download private rows.
const timedFetch: typeof fetch = (input, init) => fetch(input, {
  ...init, signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), AbortSignal.timeout(5000)]),
});

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Admin overview service not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: timedFetch },
  });
}

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} },
      global: { fetch: timedFetch },
    },
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error?.name === "AuthSessionMissingError" || error?.status === 401 || error?.status === 403) return null;
  if (error) throw new Error("Identity verification unavailable");
  return user?.id ?? null;
}

type CountTable = "profiles" | "quizzes" | "game_results" | "game_sessions";
async function headCount(service: ReturnType<typeof serviceClient>, table: CountTable, filter?: "public" | "active"): Promise<number | null> {
  try {
    let query = service.from(table).select("*", { count: "exact", head: true });
    if (filter === "public") query = query.eq("is_public", true).is("archived_at", null);
    if (filter === "active") query = query.in("status", ["waiting", "active"]);
    const { count, error } = await query;
    return error ? null : count;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Construct the privileged client only AFTER cookie identity is verified.
  let service: ReturnType<typeof serviceClient>;
  return handleAdminOverviewRequest({
    resolveUserId: () => resolveUserId(request),
    loadIsAdmin: async (userId) => {
      service = serviceClient();
      const { data, error } = await service.from("profiles").select("is_admin").eq("id", userId).single();
      if (error) throw new Error("Admin lookup failed");
      return data?.is_admin === true;
    },
    loadCounts: async (): Promise<AdminOverviewCounts> => {
      const [profiles, quizzes, public_quizzes, game_results, game_sessions, active_game_sessions] = await Promise.all([
        headCount(service, "profiles"),
        headCount(service, "quizzes"),
        headCount(service, "quizzes", "public"),
        headCount(service, "game_results"),
        headCount(service, "game_sessions"),
        headCount(service, "game_sessions", "active"),
      ]);
      // No unbounded/truncated plays download masquerading as a global sum.
      // An exact legacy-counter aggregate needs a separately approved DB seam.
      return { profiles, quizzes, public_quizzes, game_results, game_sessions, active_game_sessions, total_plays: null };
    },
  });
}

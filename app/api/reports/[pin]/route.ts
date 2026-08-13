// 2026-08-13: Server-side proxy for game reports.
// Direct Supabase reads from the browser were RLS-bypassing the new
// game_results RLS (which now requires auth.uid() = host_id). The browser
// cannot rely on the user being authed as the host, so we proxy via
// this route which uses the service-role client. The HOST ID CHECK stays
// in this route too — pinning per-game ownership.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

// Match all 6-char PINs (alphanumeric, matching the Phoenix Pin generator)
const PIN_RE = /^[A-Z0-9]{4,12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pin: string }> }
) {
  const { pin } = await params;

  // Defense: never let the DB see malformed PIN patterns.
  if (!PIN_RE.test(pin)) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // 1) Identify the caller via session cookies.
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() { /* no-op */ },
      },
    }
  );
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to view this report" }, { status: 401 });
  }

  // 2) Use service-role key to look up the report. The new RLS policy
  //    (game_results read by host) prevents the anon key from doing this,
  //    so service-role is intentional and required.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await admin
    .from("game_results")
    .select("*")
    .eq("pin", pin.toUpperCase())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // 3) PIN ownership check (defense in depth — even though
  //    host_id matches auth.uid() under the new RLS, this matches what
  //    the old client-side check expected and is symmetric with admin).
  if ((data as { host_id?: string }).host_id !== user.id) {
    return NextResponse.json(
      { error: "This game report is only visible to the host who started the game." },
      { status: 403 }
    );
  }

  return NextResponse.json({ result: data });
}

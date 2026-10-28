import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";

// Exercise the real route with local boundary adapters, never the live provider.
async function routeHarness(admin: boolean, failedTable?: string, signedOut = false) {
  const calls: { table: string; columns?: string; options?: unknown; filters: unknown[] }[] = [];
  const service = { from(table: string) {
    const call = { table, columns: undefined as string | undefined, options: undefined as unknown, filters: [] as unknown[] };
    calls.push(call);
    const query = {
      select(columns: string, options?: unknown) { call.columns = columns; call.options = options; return query; },
      eq(...args: unknown[]) { call.filters.push(["eq", ...args]); return query; },
      is(...args: unknown[]) { call.filters.push(["is", ...args]); return query; },
      in(...args: unknown[]) { call.filters.push(["in", ...args]); return query; },
      single: async () => ({ data: { is_admin: admin }, error: null }),
      then(resolve: (v: unknown) => unknown) { return Promise.resolve({ count: 7, error: table === failedTable ? { message: "unavailable" } : null }).then(resolve); },
    };
    return query;
  } };
  const bundle = await build({
    entryPoints: ["app/api/admin/overview/route.ts"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "local-admin-boundaries", setup(b) {
      b.onResolve({ filter: /^server-only$/ }, () => ({ path: "marker", namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "", loader: "js" }));
    } }],
  });
  const nativeRequire = createRequire(import.meta.url);
  const mod = { exports: {} as { GET: (req: unknown) => Promise<Response> } };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((id: string) => {
    if (id === "@supabase/supabase-js") return { createClient: () => service };
    if (id === "@supabase/ssr") return { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: signedOut ? null : { id: "verified-operator" } }, error: signedOut ? { name: "AuthSessionMissingError" } : null }) } }) };
    return nativeRequire(id);
  }, mod, mod.exports);
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-only";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://local.invalid";
  try {
    const response = await mod.exports.GET({ cookies: { getAll: () => [] } });
    return { response, calls };
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
  }
}

test("real admin route verifies profile then uses HEAD counts only and no legacy-counter scan", async () => {
  const { response, calls } = await routeHarness(true, "game_results");
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.counts.profiles, 7);
  assert.equal(body.counts.game_results, null);
  assert.equal(body.counts.total_plays, null);
  assert.deepEqual(calls[0].filters, [["eq", "id", "verified-operator"]]);
  assert.equal(calls[0].columns, "is_admin");
  assert.equal(calls.length, 7);
  for (const call of calls.slice(1)) assert.deepEqual(call.options, { count: "exact", head: true });
  assert.ok(calls.some(call => JSON.stringify(call.filters).includes("archived_at")));
});

test("real admin route rejects a missing cookie session without constructing a service query", async () => {
  const { response, calls } = await routeHarness(false, undefined, true);
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test("real admin route denies a non-admin before any HEAD count", async () => {
  const { response, calls } = await routeHarness(false);
  assert.equal(response.status, 403);
  assert.equal(calls.length, 1);
});

// Render the actual admin page with explicit hook snapshots. This is not a
// browser/effect-race test; it checks unknown totals and account-switch gating.
async function renderAdminSnapshot(owner: string) {
  const bundle = await build({
    entryPoints: ["app/admin/page.tsx"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic",
    plugins: [{ name: "admin-render-boundaries", setup(b) {
      b.onResolve({ filter: /(?:supabase-provider|supabase\/client)$/ }, args => ({ path: args.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, args => ({ contents: args.path.endsWith("supabase-provider") ? 'export function useAuth(){return {user:{id:"operator"},loading:false}}' : 'export const supabase = {};', loader: "js" }));
    } }],
  });
  const nativeRequire = createRequire(import.meta.url);
  const react = nativeRequire("react");
  const states: unknown[] = [true, "overview", [], [], [], [], false, "unavailable", null, owner, false];
  let index = 0;
  const mod = { exports: {} as { default: () => unknown } };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((id: string) => id === "react" ? {
    ...react, useEffect: () => {}, useState: () => [states[index++], () => {}],
  } : nativeRequire(id), mod, mod.exports);
  return nativeRequire("react-dom/server").renderToStaticMarkup(react.createElement(mod.exports.default));
}

test("admin renders unavailable global counts rather than successful zero fallbacks", async () => {
  const html = await renderAdminSnapshot("operator");
  assert.match(html, /— means unavailable/);
  assert.match(html, /not global totals/);
  assert.match(html, /do not establish adoption/);
  assert.match(html, /anonymous increments/);
  assert.doesNotMatch(html, /report-stat-value[^>]*>0</);
});

test("admin hides previous account snapshots immediately when identity changes", async () => {
  const html = await renderAdminSnapshot("previous-operator");
  assert.match(html, /Checking authorization/);
  assert.doesNotMatch(html, /Admin Panel|Legacy play counter/);
});

// Contract for the service-side admin overview aggregates: the route must
// verify a real cookie user, authorize against the authoritative profiles row
// (not a client claim), and return only narrow allowlisted counts — never rows
// or private answer/result payloads. Browser-side admin reads run under
// host-only RLS and cannot represent all-game stats (audit 2026-10-28).
import { ALLOWED_COUNT_KEYS, handleAdminOverviewRequest, type AdminOverviewDeps, type AdminOverviewCounts } from "../app/api/admin/overview/aggregates";

type Counts = Record<string, number | null>;

test("identity lookup failure never attempts authorization or loads data", async () => {
  const response = await handleAdminOverviewRequest({
    resolveUserId: async () => { throw new Error("offline"); },
    loadIsAdmin: async () => { assert.fail("must not authorize"); },
    loadCounts: async () => { assert.fail("must not load"); },
  });
  assert.equal(response.status, 503);
});

test("invalid count values and row payloads are stripped; response cannot be cached", async () => {
  const response = await handleAdminOverviewRequest(adminDeps({
    loadCounts: async () => ({ ...(await allCounts()), profiles: -1, quizzes: NaN, public_quizzes: 1.5, private_rows: ["secret"] }),
  }));
  const body = await response.json();
  assert.equal(body.counts.profiles, null);
  assert.equal(body.counts.quizzes, null);
  assert.equal(body.counts.public_quizzes, null);
  assert.equal(body.counts.private_rows, undefined);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});

async function call(deps: AdminOverviewDeps) {
  const response = await handleAdminOverviewRequest(deps);
  return { status: response.status, body: await response.json() };
}

const allCounts = async (): Promise<AdminOverviewCounts> => ({
  profiles: 32,
  quizzes: 207,
  public_quizzes: 188,
  game_results: 68,
  game_sessions: 23,
  active_game_sessions: 0,
  total_plays: 3417,
});

function adminDeps(overrides: Partial<AdminOverviewDeps> = {}): AdminOverviewDeps {
  return {
    resolveUserId: async () => "operator-1",
    loadIsAdmin: async () => true,
    loadCounts: allCounts,
    ...overrides,
  };
}

test("unauthenticated requests are rejected before any aggregate is loaded", async () => {
  let countsLoaded = false;
  const { status, body } = await call(adminDeps({
    resolveUserId: async () => null,
    loadCounts: async () => { countsLoaded = true; return allCounts(); },
  }));
  assert.equal(status, 401);
  assert.equal(countsLoaded, false);
  assert.ok(String((body as { error?: string }).error).toLowerCase().includes("sign in"));
});

test("authenticated non-admins are denied the aggregates", async () => {
  const { status } = await call(adminDeps({ loadIsAdmin: async () => false }));
  assert.equal(status, 403);
});

test("an authorization lookup failure fails closed instead of leaking counts", async () => {
  const { status } = await call(adminDeps({ loadIsAdmin: async () => { throw new Error("profiles unavailable"); } }));
  assert.equal(status, 503);
});

test("authorized admins receive exactly the allowlisted numeric aggregates", async () => {
  const { status, body } = await call(adminDeps());
  assert.equal(status, 200);
  const counts = (body as { counts: Counts }).counts;
  assert.deepEqual(Object.keys(counts).sort(), [...ALLOWED_COUNT_KEYS].sort());
  for (const value of Object.values(counts)) {
    assert.ok(value === null || Number.isSafeInteger(value));
  }
  // No row-level payload may ride along with the aggregates.
  assert.deepEqual(Object.keys(body as object).sort(), ["counts"]);
});

test("a failing count degrades to null without failing the whole overview", async () => {
  const { status, body } = await call(adminDeps({
    loadCounts: async () => {
      const ok = await allCounts();
      ok.game_results = null; // e.g. count query failed for this table
      return ok;
    },
  }));
  assert.equal(status, 200);
  const counts = (body as { counts: Counts }).counts;
  assert.equal(counts.game_results, null);
  assert.equal(counts.profiles, 32);
});

test("a thrown count loader still yields an all-null overview, not an error page", async () => {
  const { status, body } = await call(adminDeps({ loadCounts: async () => { throw new Error("storage down"); } }));
  assert.equal(status, 200);
  const counts = (body as { counts: Counts }).counts;
  for (const key of ALLOWED_COUNT_KEYS) assert.equal(counts[key], null, key);
});

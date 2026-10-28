import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Regression tests for stale-account / stale-pin async races in list/report pages
// (see quizworld-evidence/e2e-20261028/async-race-audit.md).
//
// These pages are NOT remounted when the account changes, so useAsyncScope's
// lifetime fence does not fire. The only thing that discards an old read is a
// NEW beginRead() when the effect/load re-runs. The simulation below therefore
// models an auth change exactly as React does: the effect re-runs with the new
// user (or null on sign-out). It deliberately does NOT bump the lifetime, which
// would only happen on unmount and would make these tests pass vacuously.

/** Faithful plain-JS copy of lib/use-async-scope.ts semantics. */
function asyncScopeSim() {
  const scope = { mounted: true, lifetime: 0, read: 0 };
  const capture = () => {
    const lifetime = scope.lifetime;
    return () => scope.mounted && scope.lifetime === lifetime;
  };
  const beginRead = () => {
    const current = capture();
    const read = ++scope.read;
    return () => current() && scope.read === read;
  };
  return { capture, beginRead };
}

const transpile = (text: string) =>
  ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } })
    .outputText.trim().replace(/;+\s*$/, "");

function parse(file: string) {
  const source = fs.readFileSync(file, "utf8");
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** Source text of a named function declaration in a page. */
function declText(file: string, name: string) {
  const ast = parse(file);
  let text = "";
  const visit = (n: ts.Node) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) text = n.getText(ast);
    ts.forEachChild(n, visit);
  };
  visit(ast);
  assert.ok(text, `${name} exists in ${file}`);
  return transpile(text);
}

/** Source text of the useEffect callback whose dependency array mentions `dep`. */
function effectText(file: string, dep: string) {
  const ast = parse(file);
  let arrow: ts.ArrowFunction | undefined;
  const visit = (n: ts.Node) => {
    if (
      ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "useEffect" &&
      n.arguments.length === 2 && ts.isArrayLiteralExpression(n.arguments[1]) &&
      n.arguments[1].getText(ast).includes(dep) && ts.isArrowFunction(n.arguments[0])
    ) arrow = n.arguments[0];
    ts.forEachChild(n, visit);
  };
  visit(ast);
  assert.ok(arrow, `useEffect keyed on ${dep} exists in ${file}`);
  return transpile(arrow.getText(ast));
}

const bind = (js: string, scope: Record<string, unknown>, ret: string) =>
  new Function(...Object.keys(scope), `${js}; return ${ret};`)(...Object.values(scope));

/** Thenable supabase query builder whose result waits for `gate`. */
function queryBuilder(resolve: (select: string, filters: unknown[]) => unknown, gate: Promise<void>) {
  const b: Record<string, unknown> = {};
  let sel = "";
  const filters: unknown[] = [];
  b.select = (s: string) => { sel = s; return b; };
  for (const m of ["eq", "in", "is", "order", "limit", "single", "maybeSingle"]) b[m] = (...a: unknown[]) => { filters.push(a); return b; };
  b.then = (ok: (v: unknown) => unknown, err?: (e: unknown) => unknown) => gate.then(() => resolve(sel, filters)).then(ok, err);
  return b;
}

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>(r => { release = r; });
  return { promise, release };
}

const flush = async () => { for (let i = 0; i < 10; i++) await new Promise(r => setTimeout(r, 0)); };

// --- app/classrooms/page.tsx -------------------------------------------------

function classroomsHarness() {
  const scope = asyncScopeSim();
  const state: { classrooms: unknown[] } = { classrooms: [] };
  const gateA = deferred();
  const supabase = {
    from: (table: string) => queryBuilder((sel, filters) => {
      const owner = JSON.stringify(filters).includes('B"') ? "B" : "A";
      if (table === "classroom_members" && sel.includes("role")) return { data: [{ classroom_id: `room-${owner}`, role: "teacher" }] };
      if (table === "classrooms") return { data: [{ id: `room-${owner}`, name: `${owner} private class` }] };
      return { data: [{ classroom_id: `room-${owner}` }] };
    }, gateA.promise),
  };
  const js = declText("app/classrooms/page.tsx", "load");
  const loadAs = (user: { id: string } | null) => bind(js, {
    supabase, user, beginRead: scope.beginRead,
    setClassrooms: (v: unknown[]) => { state.classrooms = v; },
    setLoading: () => {},
  }, "load") as () => Promise<void>;
  return { state, gateA, loadAs };
}

test("classrooms: signing out discards account A's in-flight read", async () => {
  const h = classroomsHarness();
  const pending = h.loadAs({ id: "A" })();
  await h.loadAs(null)(); // effect re-runs after sign-out
  h.gateA.release();
  await pending; await flush();
  assert.deepEqual(h.state.classrooms, [], "account A's classrooms must not be applied after sign-out");
});

test("classrooms: switching to account B discards account A's in-flight read", async () => {
  const h = classroomsHarness();
  const pendingA = h.loadAs({ id: "A" })();
  const pendingB = h.loadAs({ id: "B" })();
  h.gateA.release();
  await Promise.all([pendingA, pendingB]); await flush();
  const ids = (h.state.classrooms as { id: string }[]).map(r => r.id);
  assert.deepEqual(ids, ["room-B"]);
});

test("classrooms: an account change clears the previous account's list immediately", () => {
  const src = fs.readFileSync("app/classrooms/page.tsx", "utf8");
  assert.match(src, /useEffect\(\(\) => \{ setClassrooms\(\[\]\); load\(\); \}, \[user\?\.id\]\)/);
});

// --- app/present/page.tsx ----------------------------------------------------

function presentHarness() {
  const scope = asyncScopeSim();
  const state: { presentations: unknown[] } = { presentations: [] };
  const listOwner = { current: null as string | null };
  const gate = deferred();
  const supabase = {
    from: () => queryBuilder((_sel, filters) => {
      const owner = JSON.stringify(filters).includes('B"') ? "B" : "A";
      return { data: [{ id: `pres-${owner}`, slides: [{ count: 3 }] }] };
    }, gate.promise),
  };
  const js = effectText("app/present/page.tsx", "user");
  const runAs = (user: { id: string } | null) => (bind(`const effect = ${js}`, {
    supabase, user, beginRead: scope.beginRead, listOwner,
    setPresentations: (v: unknown[]) => { state.presentations = v; },
    setPresLoading: () => {},
  }, "effect") as () => void)();
  return { state, gate, runAs };
}

test("present: signing out discards account A's in-flight read", async () => {
  const h = presentHarness();
  h.runAs({ id: "A" });
  h.runAs(null);
  h.gate.release(); await flush();
  assert.deepEqual(h.state.presentations, []);
});

test("present: account A's rows are cleared as soon as account B signs in", async () => {
  const h = presentHarness();
  h.runAs({ id: "A" });
  h.gate.release(); await flush();
  assert.equal((h.state.presentations as { id: string }[])[0].id, "pres-A");
  const gateB = deferred();
  // B's read is still pending; A's rows must already be gone.
  h.runAs({ id: "B" });
  assert.deepEqual(h.state.presentations, []);
  gateB.release();
});

test("present: an uninterrupted read still applies", async () => {
  const h = presentHarness();
  h.runAs({ id: "A" });
  h.gate.release(); await flush();
  const rows = h.state.presentations as { id: string; slide_count: number }[];
  assert.equal(rows[0].id, "pres-A");
  assert.equal(rows[0].slide_count, 3);
});

// --- app/report/[pin]/page.tsx -----------------------------------------------

function reportHarness() {
  const scope = asyncScopeSim();
  const state = { result: null as unknown, error: null as string | null, pushes: [] as string[] };
  const reportKey = { current: null as string | null };
  const gate = deferred();
  const fetchMock = async (url: string) => {
    await gate.promise;
    return new Response(JSON.stringify({ result: { pin: url.split("/").pop() } }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const js = effectText("app/report/[pin]/page.tsx", "pin");
  const runAs = (user: { id: string } | null, pin: string) => (bind(`const effect = ${js}`, {
    fetch: fetchMock, user, pin, authLoading: false, beginRead: scope.beginRead, reportKey,
    router: { push: (p: string) => state.pushes.push(p) },
    setResult: (v: unknown) => { state.result = v; },
    setError: (v: string | null) => { state.error = v; },
    setLoading: () => {},
  }, "effect") as () => void)();
  return { state, gate, runAs };
}

test("report: a late PIN1 read cannot render under PIN2", async () => {
  const h = reportHarness();
  h.runAs({ id: "A" }, "PIN1");
  h.runAs({ id: "A" }, "PIN2");
  h.gate.release(); await flush();
  assert.equal((h.state.result as { pin: string }).pin, "PIN2");
});

test("report: signing out discards the in-flight host-only report", async () => {
  const h = reportHarness();
  h.runAs({ id: "A" }, "PIN1");
  h.runAs(null, "PIN1");
  h.gate.release(); await flush();
  assert.equal(h.state.result, null, "account A's host-only report must not render after sign-out");
  assert.equal(h.state.error, null);
});

test("report: an uninterrupted read still applies", async () => {
  const h = reportHarness();
  h.runAs({ id: "A" }, "PIN1");
  h.gate.release(); await flush();
  assert.equal((h.state.result as { pin: string }).pin, "PIN1");
});

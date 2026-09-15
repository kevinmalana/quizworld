import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

function handler(file: string, name: string, scope: Record<string, unknown>) {
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let text = "";
  function visit(n: ts.Node) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) text = n.getText(ast);
    ts.forEachChild(n, visit);
  }
  visit(ast);
  assert.ok(text, `${name} exists`);
  const js = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function(...Object.keys(scope), `${js}; return ${name};`)(...Object.values(scope));
}
function fixture(file: string, name: string, reply: (url: URL, init: RequestInit) => Response) {
  const requests: { url: URL; init: RequestInit }[] = [];
  const state = { msg: "", type: "", loads: 0, closed: false };
  const supabase = createClient("https://example.supabase.co", "test-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    const url = new URL(String(input)); requests.push({ url, init: init! }); return reply(url, init!);
  } } });
  const run = handler(file, name, {
    supabase, user: { id: "actor" }, id: "classroom", myRole: "teacher", joinCode: " ab12cd ",
    setMsg: (v: string) => state.msg = v, setMsgType: (v: string) => state.type = v,
    setShowJoin: (v: boolean) => state.closed = !v, setJoinCode: () => {},
    setTimeout: () => {}, confirm: () => true, load: () => state.loads++,
    checkAndGrantAchievements: async () => {},
    group: { id: "group", name: "Group" }, classroom: { id: "classroom", name: "Classroom" },
    members: [{ role: "teacher" }, { role: "teacher" }],
    router: { push: () => state.loads++ },
    setPinMsg: (v: string) => { state.msg = v; state.type = "error"; },
    setMutationError: (v: string) => { state.msg = v; state.type = "error"; },
  });
  return { run, requests, state };
}
for (const [kind, rpc] of [["groups", "join_trivia_group_by_code"], ["classrooms", "join_classroom_by_code"]]) {
  test(`${kind}: private code redemption succeeds without pre-membership SELECT`, async () => {
    const f = fixture(`app/${kind}/page.tsx`, "handleJoin", url => url.pathname.endsWith(`/rpc/${rpc}`) ? json("joined-id") : json([]));
    await f.run();
    assert.equal(f.state.type, "success");
    assert.equal(f.state.closed, true);
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0].url.pathname, `/rest/v1/rpc/${rpc}`);
    assert.deepEqual(JSON.parse(String(f.requests[0].init.body)), { p_code: "AB12CD" });
  });
  test(`${kind}: permission error never reports successful join`, async () => {
    const f = fixture(`app/${kind}/page.tsx`, "handleJoin", url => url.pathname.includes("/rpc/") ? json({ message: "Invalid code", code: "22023" }, 400) : json({ id: "id", name: "name" }));
    await f.run();
    assert.equal(f.state.type, "error");
    assert.equal(f.state.closed, false);
    assert.equal(f.state.loads, 0);
  });
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("code inputs do not truncate surrounding whitespace before normalization", () => {
  for (const kind of ["groups", "classrooms"]) {
    const file = `app/${kind}/page.tsx`;
    const ast = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let maxLength = 0;
    function visit(node: ts.Node) {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "input") {
        const attrs = node.attributes.properties;
        if (attrs.some(a => ts.isJsxAttribute(a) && a.name.getText(ast) === "value" && a.initializer?.getText(ast) === "{joinCode}")) {
          const max = attrs.find(a => ts.isJsxAttribute(a) && a.name.getText(ast) === "maxLength") as ts.JsxAttribute | undefined;
          maxLength = max ? Number(max.initializer?.getText(ast).replace(/[{}]/g, "")) : Infinity;
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.ok(maxLength >= " ab12cd ".length, `${kind} truncates pasted code before trim`);
  }
});

test("group membership errors render above every tab", () => {
  const source = fs.readFileSync("app/groups/[id]/page.tsx", "utf8");
  const alert = source.indexOf('{mutationError &&');
  assert.ok(alert > 0 && alert < source.indexOf('{tab === "members"'), "error must be visible outside pinned-only tab");
});

for (const [kind, name] of [
  ["groups", "handleJoin"], ["groups", "handleLeave"], ["groups", "handleRemoveMember"],
  ["classrooms", "handleLeave"], ["classrooms", "handleRemoveMember"], ["classrooms", "handlePromoteToTeacher"],
]) {
  test(`${kind} ${name}: zero-row mutation is not success`, async () => {
    const f = fixture(`app/${kind}/[id]/page.tsx`, name, () => json([]));
    await f.run("other-user", "Other user");
    assert.match(f.state.msg, /could not|not.*changed|not.*removed/i);
    assert.equal(f.state.loads, 0);
  });
}

for (const response of [json([{ id: "assignment" }]), json({ message: "denied" }, 403)]) {
  test(`assignment deletion handles HTTP ${response.status}`, async () => {
    const f = fixture("app/classrooms/[id]/page.tsx", "handleDeleteAssignment", () => response);
    await f.run("assignment");
    assert.equal(f.state.type, response.ok ? "success" : "error");
    assert.equal(f.state.loads, response.ok ? 1 : 0);
  });
}

test("assignment zero-row deletion displays failure without reloading", async () => {
  const f = fixture("app/classrooms/[id]/page.tsx", "handleDeleteAssignment", () => json([]));
  await f.run("assignment");
  assert.equal(f.state.type, "error");
  assert.match(f.state.msg, /not.*removed|could not|unable/i);
  assert.equal(f.state.loads, 0);
  assert.equal(f.requests[0].url.searchParams.get("classroom_id"), "eq.classroom");
  assert.equal(f.requests[0].url.searchParams.get("select"), "id");
});

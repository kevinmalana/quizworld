import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium, type Page } from "@playwright/test";

type Kind = "report" | "present" | "classrooms";
type PrivateFixture = {
  user: { id: string } | null;
  pin: string;
  holdNewScope: boolean;
  render: () => void;
};
type FixtureWindow = Window & { privateFixture: PrivateFixture };

const pagePath: Record<Kind, string> = {
  report: "report/[pin]/page",
  present: "present/page",
  classrooms: "classrooms/page",
};

async function fixture(kind: Kind, run: (page: Page) => Promise<void>) {
  const mocks: Record<string, string> = {
    "next/link": `import React from "react"; export default p => <a {...p} />;`,
    "next/navigation": `
      const router = { push() {} };
      export const useRouter = () => router;
      export const useParams = () => ({ pin: window.privateFixture.pin });
    `,
    "@/components/supabase-provider": `
      export const useAuth = () => ({ user: window.privateFixture.user, loading: false });
    `,
    "@/lib/supabase/client": `
      export const supabase = {
        from(table) {
          let selection = "";
          const q = {
            select(value) { selection = value; return q; },
            eq() { return q; }, in() { return q; }, is() { return q; },
            order() { return q; }, limit() { return q; },
            then(resolve) {
              const fixture = window.privateFixture;
              const owner = fixture.user?.id;
              if (fixture.holdNewScope && owner === "B") return new Promise(() => {}).then(resolve);
              let data = [];
              if (table === "presentations") {
                data = [{ id: "presentation-A", title: "A private presentation", status: "draft",
                  join_code: "JOIN-A", created_at: "2026-01-01", slides: [{ count: 2 }] }];
              } else if (table === "classroom_members" && selection.includes("role")) {
                data = [{ classroom_id: "room-A", role: "teacher" }];
              } else if (table === "classroom_members") {
                data = [{ classroom_id: "room-A" }];
              } else if (table === "classrooms") {
                data = [{ id: "room-A", name: "A private classroom", description: null,
                  join_code: "JOIN-A", created_by: owner, created_at: "2026-01-01" }];
              }
              return Promise.resolve({ data, error: null }).then(resolve);
            },
          };
          return q;
        },
      };
    `,
  };
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "tsx",
      contents: `
        import React from "react";
        import { createRoot } from "react-dom/client";
        import { flushSync } from "react-dom";
        import Page from "./app/${pagePath[kind]}";
        const root = createRoot(document.getElementById("root"));
        window.privateFixture.render = () => flushSync(() => root.render(<Page />));
        window.fetch = async () => {
          const fixture = window.privateFixture;
          const owner = fixture.user?.id;
          if (fixture.holdNewScope && (owner === "B" || fixture.pin === "PIN2")) {
            return new Promise(() => {});
          }
          const nickname = owner + "-" + fixture.pin + " private player";
          return new Response(JSON.stringify({ result: {
            finished_at: "2026-01-01T00:00:00Z",
            results: { players: [{ id: nickname, nickname, score: 10, avatar: "A" }],
              question_breakdown: [], question_count: 1 },
          } }), { status: 200, headers: { "Content-Type": "application/json" } });
        };
        window.privateFixture.render();
      `,
    },
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    plugins: [{
      name: "private-render-fixtures",
      setup(b) {
        b.onResolve({ filter: /.*/ }, args => args.path.endsWith(".css")
          ? { path: args.path, namespace: "empty-css" }
          : mocks[args.path] ? { path: args.path, namespace: "fixture" } : undefined);
        b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
          contents: mocks[args.path], loader: "jsx", resolveDir: process.cwd(),
        }));
        b.onLoad({ filter: /.*/, namespace: "empty-css" }, () => ({ contents: "", loader: "js" }));
      },
    }],
  });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.request().url() === "http://private-render.local/"
      ? route.fulfill({ contentType: "text/html", body: '<main id="root"></main>' })
      : route.abort());
    await page.goto("http://private-render.local/");
    await page.addScriptTag({ content: "window.__name = fn => fn; window.process = { env: {} };" });
    await page.evaluate(() => {
      (window as unknown as FixtureWindow).privateFixture = {
        user: { id: "A" }, pin: "PIN1", holdNewScope: false, render: () => {},
      };
    });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await run(page);
    assert.deepEqual(errors, [], "real page fixture has no uncaught browser errors");
  } finally {
    await browser.close();
  }
}

for (const change of ["account", "PIN"] as const) {
  test(`report: first render after ${change} change hides the old private report before effects`, () => fixture("report", async page => {
    await page.getByText("A-PIN1 private player", { exact: true }).waitFor();
    const oldReportVisible = await page.evaluate(change => {
      const fixture = (window as unknown as FixtureWindow).privateFixture;
      fixture.holdNewScope = true;
      if (change === "account") fixture.user = { id: "B" };
      else fixture.pin = "PIN2";
      fixture.render();
      return document.body.textContent?.includes("A-PIN1 private player") ?? false;
    }, change);
    assert.equal(oldReportVisible, false, "the identity-changing commit must not contain the previous report");
  }));
}

test("present: first render after account change hides the old private list before effects", () => fixture("present", async page => {
  await page.getByText("A private presentation", { exact: true }).waitFor();
  const snapshot = await page.evaluate(() => {
    const fixture = (window as unknown as FixtureWindow).privateFixture;
    fixture.holdNewScope = true;
    fixture.user = { id: "B" };
    fixture.render();
    return document.body.textContent ?? "";
  });
  assert.equal(snapshot.includes("A private presentation"), false);
  assert.equal(snapshot.includes("JOIN-A"), false);
}));

test("classrooms: first render after account change hides the old private list before effects", () => fixture("classrooms", async page => {
  await page.getByText("A private classroom", { exact: true }).waitFor();
  const snapshot = await page.evaluate(() => {
    const fixture = (window as unknown as FixtureWindow).privateFixture;
    fixture.holdNewScope = true;
    fixture.user = { id: "B" };
    fixture.render();
    return document.body.textContent ?? "";
  });
  assert.equal(snapshot.includes("A private classroom"), false);
  assert.equal(snapshot.includes("JOIN-A"), false);
}));

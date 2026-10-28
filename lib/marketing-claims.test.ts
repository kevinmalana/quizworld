import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";

// Renders the real marketing pages (only next/link is stubbed as <a>) and
// checks their honest-capability contract: no unsourced adoption totals, no
// "always free" pricing promises, no freshly-unverified competitor specifics,
// and participant limits stated as roster caps, not load certificates.
// Audit F4, 2026-10-28: live library had 188 public quizzes, not "thousands".
const BANNED_CLAIMS = [
  /thousands of quizzes/i,
  /everything kahoot does/i,
  /always free/i,
  /thousands of students/i,
  /100% free/i,
  /no paywalls, no limits/i,
  /10 in free plan/i,
  /paid add-on/i,
  /separate product/i,
];

async function renderPage(relativePath: string) {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "tsx",
      contents: `
        import React from 'react';
        import { renderToStaticMarkup } from 'react-dom/server';
        import Page, { metadata } from '${relativePath}';
        export function render() {
          return Promise.resolve(Page({})).then((el) => renderToStaticMarkup(el));
        }
        export { metadata };
      `,
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    jsx: "automatic",
    tsconfig: "tsconfig.json",
    plugins: [{
      name: "marketing-boundaries",
      setup(b) {
        b.onResolve({ filter: /^next\/link$/ }, () => ({ path: "next-link-stub", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          loader: "tsx",
          resolveDir: process.cwd(),
          contents: `import React from 'react'; export default function Link(p){ return React.createElement('a', { href: p.href, className: p.className }, p.children); };`,
        }));
      },
    }],
  });
  const mod = { exports: {} as { render: () => Promise<string>; metadata?: { title?: string; description?: string; openGraph?: { title?: string; description?: string } } } };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), mod, mod.exports);
  return { html: await mod.exports.render(), metadata: mod.exports.metadata };
}

function assertNoBannedClaims(context: string, ...texts: (string | undefined)[]) {
  for (const text of texts) {
    if (!text) continue;
    for (const banned of BANNED_CLAIMS) {
      assert.doesNotMatch(text, banned, `${context} must not claim: ${banned}`);
    }
  }
}

test("kahoot-alternative page states honest capabilities", async () => {
  const { html, metadata } = await renderPage("./app/kahoot-alternative/page");
  assertNoBannedClaims("kahoot-alternative body", html);
  assertNoBannedClaims(
    "kahoot-alternative metadata",
    metadata?.title, metadata?.description, metadata?.openGraph?.title, metadata?.openGraph?.description,
  );
  // Honest replacements: the roster cap is labelled as a cap, and the library
  // is described as a community library without an invented size.
  assert.match(html, /roster cap/i);
  assert.match(html, /community (quiz )?library/i);
  assert.match(html, /200 players per game/i);
});

test("aws-practice-test page states honest capabilities", async () => {
  const { html, metadata } = await renderPage("./app/aws-practice-test/page");
  assertNoBannedClaims("aws-practice-test body", html);
  assertNoBannedClaims(
    "aws-practice-test metadata",
    metadata?.title, metadata?.description, metadata?.openGraph?.title, metadata?.openGraph?.description,
  );
  // The CTA must invite action without an unsourced adoption total.
  assert.match(html, /Create practice quizzes|study group/i);
});

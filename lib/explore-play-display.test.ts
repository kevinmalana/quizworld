import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";

import { PLAY_COUNTER_PROVENANCE } from "./catalog-metrics";

// Renders the real ExploreQuizCard (only next/link is stubbed as <a>, matching
// the repo's established esbuild render pattern) to prove the catalog surfaces
// the play counter with its provenance instead of implying verified usage.
async function renderExploreCard(quiz: Record<string, unknown>): Promise<string> {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "tsx",
      contents: `
        import React from 'react';
        import { renderToStaticMarkup } from 'react-dom/server';
        import { ExploreQuizCard } from './components/explore/explore-quiz-card';
        export function render(quiz) {
          return renderToStaticMarkup(React.createElement(ExploreQuizCard, { quiz }));
        }
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
      name: "explore-card-boundaries",
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
  const mod = { exports: {} as { render: (quiz: Record<string, unknown>) => string } };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), mod, mod.exports);
  return mod.exports.render(quiz);
}

const SEEDED_QUIZ = {
  id: "card-fixture-1",
  title: "Seeded Science Quiz",
  category: "Science & Nature",
  plays: 3417,
  question_count: 12,
  creator_username: "fixture",
  creator_display_name: "Fixture Author",
};

test("explore cards format the seeded play count through the shared metric source", async () => {
  const html = await renderExploreCard(SEEDED_QUIZ);
  assert.match(html, /3,417 plays/);
});

test("explore cards disclose the community-counter provenance on the play metric", async () => {
  const html = await renderExploreCard(SEEDED_QUIZ);
  assert.ok(html.includes(PLAY_COUNTER_PROVENANCE), "card must carry the shared provenance text");
  assert.match(html, /not a verified completion count/);
});

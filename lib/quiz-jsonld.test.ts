import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

// Exercise the real async detail page and HTML parser. Only data/client-widget
// boundaries are synthetic: no public fixture writes or CSP-dependent protection.
test("quiz JSON-LD preserves untrusted text without ending its script element", async () => {
  const payload = '</ScRiPt><script>window.jsonLdInjected = true</script><img id="injected-jsonld" src=x><!-- <script> & \\" \u2028\u2029 🧠';
  const quiz = { id: "fixture", slug: payload, title: payload, category: payload, questions: [{id: "q", text: payload}], creator_id: null };
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from 'react';
      import {renderToStaticMarkup} from 'react-dom/server';
      import Page from './app/quiz/[id]/page';
      export async function render() { return renderToStaticMarkup(await Page({params:Promise.resolve({id:'fixture'})})); }
    ` },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic",
    plugins: [{ name: "detail-boundaries", setup(b) {
      b.onResolve({filter: /^(next\/link|next\/navigation|@\/utils\/supabase\/server|\.\/QuizDetailShareButton|\.\/QuizToPresentationButton)$/}, args => ({path: args.path, namespace: "fixture"}));
      b.onLoad({filter: /.*/, namespace: "fixture"}, args => ({loader: "jsx", resolveDir: process.cwd(), contents:
        args.path === "next/link" ? `import React from 'react'; export default function Link(p) {return <a {...p}/>}` :
        args.path === "next/navigation" ? `export function notFound(){throw Error('not found')} export function redirect(){throw Error('redirect')}` :
        args.path.includes("supabase/server") ? `export async function createClient(){return {from(){const q={select(){return q},eq(){return q},single(){return Promise.resolve({data:${JSON.stringify(quiz)}})}};return q}}}` :
        `export function QuizDetailShareButton(){return null} export function QuizToPresentationButton(){return null}`
      }));
    }}],
  });
  const mod = {exports: {} as {render: () => Promise<string>}};
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), mod, mod.exports);
  const html = await mod.exports.render();
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage();
    await page.route("**/*", route => route.abort());
    await page.setContent(html);
    assert.equal(await page.locator("#injected-jsonld").count(), 0, "untrusted JSON must not create HTML elements");
    assert.equal(await page.evaluate(() => "jsonLdInjected" in window), false, "untrusted text must never execute");
    assert.equal(await page.locator("script").count(), 1);
    const text = await page.locator('script[type="application/ld+json"]').textContent();
    assert.ok(text);
    const parsed = JSON.parse(text);
    assert.equal(parsed.name, payload);
    assert.equal(parsed.about.name, payload);
    assert.equal(parsed.hasPart[0].name, payload);
    assert.equal(parsed.url, "https://www.quizworld.xyz/quiz/" + payload);
    assert.equal(parsed["@type"], "Quiz");
  } finally { await browser.close(); }
});

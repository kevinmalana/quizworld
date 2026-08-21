import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("flashcard reveal is keyboard operable", () => {
  const source = readFileSync(new URL("components/study/study-session-panels.tsx", root), "utf8");
  assert.match(source, /role=\{!isBack \? "button" : undefined\}/);
  assert.match(source, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(source, /tabIndex=\{!isBack && !advancing \? 0 : -1\}/);
});

test("global controls have visible focus and minimum touch targets", () => {
  const css = readFileSync(new URL("app/globals.css", root), "utf8");
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /a\[href\][\s\S]*min-height:\s*44px/);
  assert.match(css, /a\[href\]\s*\{[\s\S]*display:\s*inline-flex/);
  assert.doesNotMatch(css.match(/\.cookie-notice\s*\{[\s\S]*?\}/)?.[0] ?? "", /position:\s*fixed/);
});

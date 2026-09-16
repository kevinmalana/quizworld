import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function components(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? components(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

test("links and CTAs avoid decorative arrows while directional controls remain", () => {
  const files = [...components("app"), ...components("components")];
  assert.ok(files.length > 0);
  for (const file of files) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      // These arrows communicate sequencing, sorting or content transformation.
      if (/^\s*\/\/|Next →|Continue →|A → Z|Z → A|Level milestones:|Topic or brief →/.test(line)) continue;
      assert.doesNotMatch(line, /↗|→|ArrowUpRight/, file);
    }
  }
  assert.match(readFileSync("components/present/live/live-status-panels.tsx", "utf8"), /Next →/);
  assert.match(readFileSync("app/privacy/page.tsx", "utf8"), /← Back to QuizWorld/);
});

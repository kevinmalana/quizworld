import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function linkTags(source: string): string[] {
  return [...source.matchAll(/<Link\b[\s\S]*?>/g)].map((match) => match[0]);
}

test("high-traffic shell links do not eagerly prefetch every destination", () => {
  for (const path of [
    "../components/navigation.tsx",
    "../app/page.tsx",
    "../app/explore/explore-client.tsx",
    "../components/explore/explore-quiz-card.tsx",
  ]) {
    const tags = linkTags(read(path));
    assert.ok(tags.length > 0, `${path} should contain links`);
    for (const tag of tags) {
      assert.match(tag, /prefetch=\{false\}/, `${path} contains an eager Link: ${tag}`);
    }
  }
});

test("the home explanation avoids decorative video delivery and uses locally licensed typography", () => {
  const home = read("../app/page.tsx");
  assert.doesNotMatch(home, /<video|hero-orbital-globe/);
  assert.match(home, /RoundPreview/);
  for (const name of ["bricolage-latin.woff2", "dm-sans-latin.woff2"]) {
    assert.ok(statSync(new URL(`../public/fonts/${name}`, import.meta.url)).size < 100_000);
  }
});

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

test("the decorative hero loop stays within its web delivery budget", () => {
  const mp4 = statSync(new URL("../public/media/quizworld/hero-orbital-globe-20260821.mp4", import.meta.url));
  const webm = statSync(new URL("../public/media/quizworld/hero-orbital-globe-20260821.webm", import.meta.url));
  const home = read("../app/page.tsx");

  assert.ok(mp4.size < 1_000_000, `MP4 is ${mp4.size} bytes`);
  assert.ok(webm.size < 600_000, `WebM is ${webm.size} bytes`);
  assert.ok(
    home.indexOf("hero-orbital-globe-20260821.webm") < home.indexOf("hero-orbital-globe-20260821.mp4"),
    "WebM should be offered before MP4",
  );
});

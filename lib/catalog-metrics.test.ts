import assert from "node:assert/strict";
import test from "node:test";

import {
  PLAY_COUNTER_PROVENANCE,
  MOST_PLAYED_SORT_HINT,
  formatPlayCount,
  playCountTitle,
} from "./catalog-metrics";

test("play counters are described with their seeded and unverified provenance", () => {
  assert.match(PLAY_COUNTER_PROVENANCE, /seed/i);
  assert.match(PLAY_COUNTER_PROVENANCE, /anonym/i);
  assert.match(PLAY_COUNTER_PROVENANCE, /not.{0,40}verified/i);
  // The provenance must be stable enough to surface in tooltips/sort hints.
  assert.ok(PLAY_COUNTER_PROVENANCE.length > 40 && PLAY_COUNTER_PROVENANCE.length < 300);
  assert.ok(MOST_PLAYED_SORT_HINT.includes("counter"));
});

test("formatPlayCount renders locale-formatted counts without inventing verification", () => {
  assert.equal(formatPlayCount(3417), "3,417 plays");
  assert.equal(formatPlayCount(0), "0 plays");
  assert.equal(formatPlayCount(1), "1 play");
  assert.doesNotMatch(formatPlayCount(3417), /completed|verified/i);
});

test("playCountTitle pairs the count with the provenance for accessible surfaces", () => {
  const title = playCountTitle(3417);
  assert.ok(title.startsWith("3,417 plays"));
  assert.ok(title.includes(PLAY_COUNTER_PROVENANCE));
});

test("non-finite play values render an explicit unknown instead of a fake number", () => {
  assert.equal(formatPlayCount(Number.NaN), "plays unknown");
  assert.equal(formatPlayCount(-5), "plays unknown");
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  parseCatalogCache,
  serializeCatalogCache,
} from "../lib/catalog-cache.ts";

test("serializeCatalogCache and parseCatalogCache round-trip quiz snapshots", () => {
  const raw = serializeCatalogCache([{ id: "quiz-1", title: "Earth Facts" }], 1_700_000_000_000);
  const parsed = parseCatalogCache<{ id: string; title: string }>(raw, 60_000, 1_700_000_020_000);

  assert.deepEqual(parsed, {
    items: [{ id: "quiz-1", title: "Earth Facts" }],
    savedAt: 1_700_000_000_000,
    ageMs: 20_000,
    stale: false,
  });
});

test("parseCatalogCache marks snapshots as stale when they exceed the max age", () => {
  const raw = JSON.stringify({
    savedAt: 1_700_000_000_000,
    items: [{ id: "quiz-2" }],
  });

  const parsed = parseCatalogCache<{ id: string }>(raw, 5_000, 1_700_000_010_000);

  assert.equal(parsed?.stale, true);
  assert.equal(parsed?.ageMs, 10_000);
});

test("parseCatalogCache preserves intentionally empty catalog snapshots", () => {
  const raw = serializeCatalogCache([], 1_700_000_000_000);
  const parsed = parseCatalogCache<never>(raw, 60_000, 1_700_000_001_000);

  assert.deepEqual(parsed, {
    items: [],
    savedAt: 1_700_000_000_000,
    ageMs: 1_000,
    stale: false,
  });
});

test("parseCatalogCache rejects malformed cache payloads", () => {
  assert.equal(parseCatalogCache("not json", 60_000), null);
  assert.equal(parseCatalogCache(JSON.stringify({ savedAt: "yesterday", items: [] }), 60_000), null);
  assert.equal(parseCatalogCache(JSON.stringify({ savedAt: Date.now(), items: {} }), 60_000), null);
});

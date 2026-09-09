import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import * as catalog from "./catalog-discovery";

// Isolated PostgREST wire fixture, not a real database/RLS test.
test("normalized title/topic search paginates the complete filtered catalog in requested order", async () => {
  const fetchPage = catalog.fetchCatalogPage;
  assert.equal(typeof fetchPage, "function");
  const urls: URL[] = [];
  const rows = Array.from({ length: 61 }, (_, i) => ({ id: `id-${String(i).padStart(3, "0")}`, title: `Map ${i}`, category: "Geography", plays: i, created_at: `2026-01-${String(i % 28 + 1).padStart(2, "0")}` }));
  const client = createClient("http://127.0.0.1:9", "fixture-anon", { global: { fetch: async (input, init) => {
    const url = new URL(String(input)); urls.push(url);
    assert.equal(url.searchParams.get("is_public"), "eq.true");
    assert.equal(url.searchParams.get("archived_at"), "is.null");
    assert.match(url.searchParams.getAll("or").join("&"), /title\.ilike.*geography.*category\.ilike.*geography/);
    assert.match(url.searchParams.getAll("or").join("&"), /category\.ilike.*Geography/);
    if (init?.method === "HEAD") return new Response(null, { headers: { "Content-Range": "*/61" } });
    assert.equal(url.searchParams.has("offset"), false, "must preserve keyset pagination");
    const order = url.searchParams.get("order");
    assert.equal(order, "plays.desc,id.asc");
    const cursorMatch = url.searchParams.getAll("or").join("&").match(/plays.lt.(\d+)/);
    const before = cursorMatch ? Number(cursorMatch[1]) : Infinity;
    const limit = Number(url.searchParams.get("limit"));
    const sorted = [...rows].filter(r => r.plays < before).sort((a, b) => b.plays - a.plays);
    return new Response(JSON.stringify(sorted.slice(0, limit)), { headers: { "Content-Type": "application/json", "Content-Range": "*/61" } });
  } } });
  let collected: { id: string; plays: number }[] = [];
  let cursor: catalog.CatalogCursor | null = null;
  for (const offset of [0, 24, 48]) {
    const page = await fetchPage(client, { search: "  GEOgraphy  ", category: " geography ", sort: "popular", cursor, loadedCount: offset, pageSize: 24 });
    assert.equal(page.totalCount, 61);
    cursor = page.nextCursor;
    collected = [...collected, ...page.quizzes];
    assert.equal(page.hasMore, offset < 48);
  }
  assert.equal(new Set(collected.map(r => r.id)).size, 61);
  assert.equal(collected[0].plays, 60);
  assert.equal(collected.at(-1)?.plays, 0);
  assert.equal(urls.length, 6);
});

test("discovery normalizes whitespace and quotes user filter syntax as literal text", () => {
  const searchFilter = catalog.catalogSearchFilter;
  assert.equal(typeof searchFilter, "function");
  assert.equal(searchFilter(" Mars "), searchFilter("MARS"));
  assert.equal(searchFilter("  "), null);
  assert.equal(searchFilter("science   nature"), searchFilter("science nature"));
  assert.match(searchFilter('a,b%_"')!, /title\.ilike\."/);
  assert.ok(searchFilter('a,b%_"')!.includes('\\\\%'));
  assert.ok(searchFilter("math")!.includes("Mathematics"));
});

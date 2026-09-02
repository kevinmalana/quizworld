import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CATALOG_QUIZ_SELECT,
  canonicalizeCategory,
  catalogCategoryHref,
  catalogQuestionCount,
  categoryVariants,
  excludeFeaturedQuizzes,
  formatCatalogCount,
  mergeCatalogPage,
} from "./catalog-discovery";

test("category aliases resolve to one canonical discovery category", () => {
  assert.equal(canonicalizeCategory("Mathematics"), "Math");
  assert.equal(canonicalizeCategory(" television "), "TV Shows");
  assert.equal(canonicalizeCategory("Unknown Topic"), "Other");
  assert.deepEqual(categoryVariants("Math"), ["Math", "Mathematics"]);
});

test("catalog pages deduplicate quizzes by id while preserving first-seen order", () => {
  const merged = mergeCatalogPage(
    [{ id: "quiz-1", title: "First" }, { id: "quiz-2", title: "Second" }],
    [{ id: "quiz-2", title: "Duplicate" }, { id: "quiz-3", title: "Third" }]
  );

  assert.deepEqual(merged.map((quiz) => [quiz.id, quiz.title]), [
    ["quiz-1", "First"],
    ["quiz-2", "Second"],
    ["quiz-3", "Third"],
  ]);
});

test("featured Explore rows do not repeat in the main catalog grid", () => {
  const catalog = [{ id: "q1" }, { id: "q2" }, { id: "q3" }, { id: "q4" }];
  const result = excludeFeaturedQuizzes(catalog, [[{ id: "q1" }], [{ id: "q3" }, { id: "q1" }]]);
  assert.deepEqual(result.map((quiz) => quiz.id), ["q2", "q4"]);
});

test("catalog pages use stable keyset cursors instead of offsets", () => {
  const explore = readFileSync(new URL("../app/explore/explore-client.tsx", import.meta.url), "utf8");
  const study = readFileSync(new URL("../app/study/page.tsx", import.meta.url), "utf8");
  const cursorHelpers = readFileSync(new URL("./catalog-discovery.ts", import.meta.url), "utf8");
  assert.doesNotMatch(explore, /\.range\(/);
  assert.doesNotMatch(study, /\.range\(/);
  assert.match(explore, /countQuery[\s\S]*head: true/);
  assert.match(study, /countQuery[\s\S]*head: true/);
  assert.match(explore, /Promise\.all\(\[query, countQuery\]\)/);
  assert.match(study, /Promise\.all\(\[query, countQuery\]\)/);
  assert.match(explore, /catalogCursorFilter/);
  assert.match(cursorHelpers, /created_at\.lt|plays\.lt|title\.gt/);
  assert.match(study, /created_at\.lt/);
});

test("catalog category links preserve reserved characters", () => {
  const href = catalogCategoryHref("Science & Nature");
  const parsed = new URL(href, "https://www.quizworld.xyz");
  assert.equal(parsed.pathname, "/explore");
  assert.equal(parsed.searchParams.get("category"), "Science & Nature");
  assert.match(href, /Science%20%26%20Nature/);
});

test("catalog cards request only display fields and question ids", () => {
  assert.doesNotMatch(CATALOG_QUIZ_SELECT, /\*/);
  assert.doesNotMatch(CATALOG_QUIZ_SELECT, /answers/i);
  assert.match(CATALOG_QUIZ_SELECT, /id,slug,title,category,emoji,color,plays,creator_id,created_at/);
  assert.match(CATALOG_QUIZ_SELECT, /questions\(id\)/);
});

test("catalog question counts work with lean relation rows and stored counts", () => {
  assert.equal(catalogQuestionCount({ questions: [{ id: "q1" }, { id: "q2" }] }), 2);
  assert.equal(catalogQuestionCount({ question_count: 7, questions: [] }), 7);
  assert.equal(catalogQuestionCount({ questions: null }), 0);
});

test("Explore server-renders the initial catalog and avoids a duplicate browser fetch", () => {
  const serverPage = readFileSync(new URL("../app/explore/page.tsx", import.meta.url), "utf8");
  const serverCatalog = readFileSync(new URL("./catalog-server.ts", import.meta.url), "utf8");
  const clientPage = readFileSync(new URL("../app/explore/explore-client.tsx", import.meta.url), "utf8");

  assert.match(serverPage, /getInitialExploreCatalog/);
  assert.match(serverCatalog, /unstable_cache/);
  assert.match(serverPage, /initialCatalog=/);
  assert.match(serverPage, /key=\{initialCategory\}/);
  assert.match(serverPage, /searchParams/);
  assert.match(clientPage, /initialCatalog/);
  assert.match(clientPage, /skipInitialFetchRef/);
  assert.doesNotMatch(clientPage, /useSearchParams/);
});

test("Explore category artwork uses responsive images with reserved dimensions", () => {
  const clientPage = readFileSync(new URL("../app/explore/explore-client.tsx", import.meta.url), "utf8");
  assert.match(clientPage, /from "next\/image"/);
  assert.match(clientPage, /width=\{480\}/);
  assert.match(clientPage, /height=\{336\}/);
  assert.match(clientPage, /sizes=/);
  assert.match(clientPage, /preload=\{index < 2\}/);
  assert.doesNotMatch(clientPage, /<img[\s\S]*CATEGORY_FAMILY_ART/);
});

test("catalog count copy distinguishes loaded rows from the exact total", () => {
  assert.equal(formatCatalogCount(24, 137, "public quiz"), "Showing 24 of 137 public quizzes");
  assert.equal(formatCatalogCount(1, 1, "result"), "Showing 1 result");
});

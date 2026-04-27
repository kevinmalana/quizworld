import test from "node:test";
import assert from "node:assert/strict";

import {
  EXPLORE_ALL_CATEGORY,
  buildExploreCategoryHref,
  getValidExploreCategory,
} from "../lib/explore-routing.ts";

const categories = ["All", "Art & Literature", "Science & Nature", "History"] as const;

test("buildExploreCategoryHref omits the category query for the all filter", () => {
  assert.equal(buildExploreCategoryHref(EXPLORE_ALL_CATEGORY), "/explore");
});

test("buildExploreCategoryHref URL-encodes category names with spaces and ampersands", () => {
  const href = buildExploreCategoryHref("Art & Literature");
  assert.equal(href, "/explore?category=Art+%26+Literature");
  assert.equal(new URL(href, "https://quizworld.test").searchParams.get("category"), "Art & Literature");
});

test("getValidExploreCategory falls back to All for missing or unknown query params", () => {
  assert.equal(getValidExploreCategory(null, categories), "All");
  assert.equal(getValidExploreCategory("Unknown", categories), "All");
  assert.equal(getValidExploreCategory("Science & Nature", categories), "Science & Nature");
});

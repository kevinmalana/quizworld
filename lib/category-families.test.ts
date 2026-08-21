import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { CATEGORY_FAMILY_ART, CATEGORY_FAMILY_IDS } from "./category-families";

test("category family artwork covers every QuizWorld family", () => {
  assert.deepEqual(CATEGORY_FAMILY_IDS, [
    "academic",
    "entertainment",
    "professional",
    "world",
    "lifestyle",
    "discovery",
  ]);

  for (const asset of Object.values(CATEGORY_FAMILY_ART)) {
    assert.match(asset, /^\/media\/quizworld\/categories\/[a-z0-9-]+\.webp$/);
    assert.equal(existsSync(join(process.cwd(), "public", asset.slice(1))), true, `${asset} must exist`);
  }
});

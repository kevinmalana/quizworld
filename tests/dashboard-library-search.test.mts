import test from "node:test";
import assert from "node:assert/strict";

import {
  getDashboardQuizQuestionCount,
  getDashboardQuizSearchValues,
  matchesDashboardSearch,
} from "../lib/dashboard-library-search.ts";

test("matchesDashboardSearch ignores blank queries", () => {
  assert.equal(matchesDashboardSearch("   ", []), true);
});

test("matchesDashboardSearch compares strings case-insensitively", () => {
  assert.equal(matchesDashboardSearch("science", ["Science & Nature", "Public"]), true);
  assert.equal(matchesDashboardSearch("PRIVATE", ["Science & Nature", "private"]), true);
  assert.equal(matchesDashboardSearch("history", ["Science & Nature", "public"]), false);
});

test("getDashboardQuizQuestionCount reads Supabase count relation rows", () => {
  assert.equal(getDashboardQuizQuestionCount({ questions: [{ count: 12 }] }), 12);
  assert.equal(getDashboardQuizQuestionCount({ questions: [] }), 0);
  assert.equal(getDashboardQuizQuestionCount({ questions: null }), 0);
});

test("getDashboardQuizSearchValues includes category, status, question labels, and plays", () => {
  const values = getDashboardQuizSearchValues({
    title: "Lab Safety",
    category: "Science & Nature",
    emoji: "🔬",
    is_public: false,
    archived_at: null,
    plays: 7,
    questions: [{ count: 1 }],
  });

  assert.equal(matchesDashboardSearch("science", values), true);
  assert.equal(matchesDashboardSearch("private", values), true);
  assert.equal(matchesDashboardSearch("active", values), true);
  assert.equal(matchesDashboardSearch("1 question", values), true);
  assert.equal(matchesDashboardSearch("7 plays", values), true);
});

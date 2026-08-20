import assert from "node:assert/strict";
import test from "node:test";

import { getLeaderboardXp } from "./leaderboard";

test("weekly leaderboard uses weekly XP for every display", () => {
  assert.equal(getLeaderboardXp({ total_xp: 1_850, weekly_xp: 0 }, "weekly"), 0);
});

test("global leaderboard uses all-time XP", () => {
  assert.equal(getLeaderboardXp({ total_xp: 1_850, weekly_xp: 25 }, "global"), 1_850);
});

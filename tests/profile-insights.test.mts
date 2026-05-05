import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatAverage,
  formatCompactNumber,
  getProfileInsights,
} from "../lib/profile-insights.ts";

describe("profile insights", () => {
  it("formats compact and average numbers for profile cards", () => {
    assert.equal(formatCompactNumber(1250), "1.3K");
    assert.equal(formatAverage(4), "4");
    assert.equal(formatAverage(4.25), "4.3");
    assert.equal(formatAverage(12.7), "13");
  });

  it("computes creator performance insight values", () => {
    const insights = getProfileInsights({
      quizCount: 4,
      totalPlays: 50,
      studiedCount: 3,
      hostedGames: 2,
      playersReached: 9,
      bestHostedScore: 1200,
    });

    assert.equal(insights[0].label, "Avg plays per quiz");
    assert.equal(insights[0].value, "13");
    assert.equal(insights[0].tone, "success");
    assert.match(insights[0].helper, /50 total plays/);

    assert.equal(insights[1].value, "4.5");
    assert.equal(insights[1].tone, "accent");

    assert.equal(insights[2].value, "75%");
    assert.equal(insights[2].tone, "success");
  });

  it("returns actionable empty-state copy when no activity exists", () => {
    const insights = getProfileInsights({
      quizCount: 0,
      totalPlays: 0,
      studiedCount: 0,
      hostedGames: 0,
      playersReached: 0,
      bestHostedScore: 0,
    });

    assert.equal(insights[0].value, "0");
    assert.equal(insights[0].tone, "warning");
    assert.match(insights[0].helper, /Create your first quiz/);
    assert.match(insights[1].helper, /Host a live game/);
    assert.match(insights[2].helper, /Build a library/);
  });
});

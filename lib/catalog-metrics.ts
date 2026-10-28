/**
 * Single source of truth for how public play counters are described in UI.
 *
 * The `quizzes.plays` column is a community counter: it was seeded with
 * randomized values for the launch catalog (scripts/original-quizzes.mjs) and
 * is incremented anonymously by `increment_quiz_plays` without a verified
 * completion/attempt key. It must never be presented as a verified or audited
 * measure of completed usage. Every public surface that shows it should use
 * these helpers so the description stays consistent.
 */
export const PLAY_COUNTER_PROVENANCE =
  "Community play counter: includes seeded launch-catalog values and anonymous increments; not a verified completion count.";

/** Tooltip/aria hint for surfaces that rank or sort by the play counter. */
export const MOST_PLAYED_SORT_HINT =
  "Sorts by the community play counter, which includes seeded values and anonymous increments — not verified completions.";

/** Visible, compact disclosure for surfaces that show the counter. Kept
 * short on purpose: the full provenance above is the tooltip/assistive text,
 * and this line must not push real catalog content below the fold. */
export const PLAY_COUNTER_SUMMARY =
  "Play counts include seeded and anonymous values, not verified completions.";

export function formatPlayCount(plays: number): string {
  if (!Number.isSafeInteger(plays) || plays < 0) return "plays unknown";
  const safe = plays;
  return `${safe.toLocaleString("en-US")} play${safe === 1 ? "" : "s"}`;
}

export function playCountTitle(plays: number): string {
  return `${formatPlayCount(plays)} — ${PLAY_COUNTER_PROVENANCE}`;
}

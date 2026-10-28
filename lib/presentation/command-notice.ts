import type { PresentationCommandOutcome } from "./command-outcome";

// Phoenix replies with machine reasons (presentations.ex / presentation_channel.ex).
// People in the audience should read what happened and what to do, not a code.
const REASON_COPY: Record<string, string> = {
  invalid_participant_token: "Your place in this presentation has expired. Rejoin with the code to keep answering.",
  not_presenter: "Only the presenter can do that.",
  not_host: "Only the presenter can do that.",
  bad_slide: "That slide is no longer active. Your screen will catch up in a moment.",
  stale_slide: "The presenter has moved on to another slide.",
  bad_response: "That answer couldn't be accepted. Check it and try again.",
  not_found: "This presentation is no longer live.",
  activity_unavailable: "Live results are briefly unavailable. Your screen will catch up in a moment.",
  insert_failed: "Your answer wasn't saved. Please try again.",
  update_failed: "That change wasn't saved. Please try again.",
  fetch_failed: "The presentation service didn't respond. Please try again.",
  missing_config: "The presentation service is unavailable right now.",
};

/** Plain-language notice for a presentation command that did not confirm. */
export function presentationCommandNotice(outcome: Exclude<PresentationCommandOutcome, { status: "confirmed" }>): string {
  const reason = outcome.reason.trim();
  const known = REASON_COPY[reason];
  if (outcome.status === "uncertain") {
    return "We couldn't confirm that action. Check the slide before trying again; it won't be resent automatically.";
  }
  if (known) return known;
  // Already a readable sentence from the client transport (e.g. "Presentation socket is not connected.").
  if (/\s/.test(reason)) return `That didn't go through: ${reason}`;
  return "That didn't go through. Please try again.";
}

// Honest outcome vocabulary for presentation commands (audit F1, 2026-10-28).
//
// "confirmed" — the presentation service replied ok; the command ran.
// "rejected"  — definitely NOT executed: it was never sent (socket offline)
//               or the server replied with an error. Safe to retry explicitly.
// "uncertain" — sent, but no reply arrived (timeout or connection dropped
//               mid-flight). The outcome is unknown: never replay these
//               automatically; surface them and let a human decide.
export type PresentationCommandOutcome =
  | { status: "confirmed" }
  | { status: "rejected"; reason: string }
  | { status: "uncertain"; reason: string };

export function confirmedOutcome(): PresentationCommandOutcome {
  return { status: "confirmed" };
}

export function rejectedOutcome(reason: string): PresentationCommandOutcome {
  return { status: "rejected", reason };
}

export function uncertainOutcome(reason: string): PresentationCommandOutcome {
  return { status: "uncertain", reason };
}

export function isConfirmedOutcome(outcome: PresentationCommandOutcome): boolean {
  return outcome.status === "confirmed";
}

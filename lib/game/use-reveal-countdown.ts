import { useEffect, useRef, useState } from "react";

/** Phoenix advances automatically this long after a reveal (game_server.ex @auto_advance_ms). */
export const AUTO_ADVANCE_MS = 15_000;

export type RevealObservation = {
  instanceId: string | null;
  questionIndex: number;
  status: string;
};

/**
 * When did this client see the current reveal begin?
 *
 * The snapshot carries no reveal timestamp, so the countdown is only shown when
 * this client watched the round go from `active` to `reveal`. A client that
 * loads (or reloads) straight into a reveal does not know how much of the
 * window has passed, so it gets `null` and shows no countdown rather than a
 * wrong one.
 */
export function nextRevealStart(
  previous: RevealObservation | null,
  next: RevealObservation,
  previousStart: number | null,
  now: number,
): number | null {
  if (next.status !== "reveal") return null;
  const sameRound = previous !== null &&
    previous.instanceId === next.instanceId &&
    previous.questionIndex === next.questionIndex;
  if (sameRound && previous.status === "reveal") return previousStart;
  if (sameRound && previous.status === "active") return now;
  return null;
}

export function secondsUntilAdvance(start: number | null, now: number): number | null {
  if (start === null) return null;
  const remaining = Math.ceil((start + AUTO_ADVANCE_MS - now) / 1000);
  return remaining > 0 ? remaining : 0;
}

export function revealCountdownLabel(seconds: number | null, isLastQuestion: boolean): string | null {
  if (seconds === null) return null;
  if (seconds <= 0) return isLastQuestion ? "Showing final results…" : "Starting the next question…";
  return isLastQuestion
    ? `Final results in ${seconds}s`
    : `Next question starts automatically in ${seconds}s`;
}

/** Seconds left before Phoenix auto-advances the current reveal, or null when unknown. */
export function useRevealCountdown(observation: RevealObservation): number | null {
  const previous = useRef<RevealObservation | null>(null);
  const start = useRef<number | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  const { instanceId, questionIndex, status } = observation;

  useEffect(() => {
    const next = { instanceId, questionIndex, status };
    start.current = nextRevealStart(previous.current, next, start.current, Date.now());
    previous.current = next;
    setSeconds(secondsUntilAdvance(start.current, Date.now()));
    if (start.current === null) return;
    const timer = window.setInterval(() => setSeconds(secondsUntilAdvance(start.current, Date.now())), 250);
    return () => window.clearInterval(timer);
  }, [instanceId, questionIndex, status]);

  return seconds;
}

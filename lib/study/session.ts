import type { StudyMode } from "./types";

export type StudyXpBreakdown = {
  xpPerCorrect: number;
  correctXp: number;
  completionBonus: number;
  perfectBonus: number;
  totalXp: number;
};

export function calculateStudyXp({
  mode,
  correct,
  total,
}: {
  mode: StudyMode;
  correct: number;
  total: number;
}): StudyXpBreakdown {
  const xpPerCorrect = mode === "quickfire" ? 45 : 25;
  const correctXp = correct * xpPerCorrect;
  const completionBonus = total > 0 ? 50 : 0;
  const perfectBonus = total > 0 && correct === total ? 100 : 0;

  return {
    xpPerCorrect,
    correctXp,
    completionBonus,
    perfectBonus,
    totalXp: correctXp + completionBonus + perfectBonus,
  };
}

export type QuickFireExpiryState = {
  mode: StudyMode;
  hasQuestion: boolean;
  sessionComplete: boolean;
  advancing: boolean;
  timerPaused: boolean;
  timeLeft: number | null;
};

export function shouldExpireQuickFireQuestion(state: QuickFireExpiryState) {
  return (
    state.mode === "quickfire" &&
    state.hasQuestion &&
    !state.sessionComplete &&
    !state.advancing &&
    !state.timerPaused &&
    state.timeLeft === 0
  );
}

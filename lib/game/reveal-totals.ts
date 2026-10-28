import type { GameAnswer } from "@/lib/game/session-normalizers";

type AnswerWithCount = GameAnswer & { count?: unknown; image_url?: string | null };
type AnswerRow = { answer_id?: string | null; is_correct?: boolean | null };

export type RevealTotals = {
  answerCounts: (GameAnswer & { count: number; image_url?: string | null })[];
  correct: number;
  total: number;
  /** True when the class-wide distribution came from Phoenix's per-option counts. */
  classWide: boolean;
};

/**
 * Class-wide answer totals for the reveal.
 *
 * Phoenix sends every viewer per-option `count`s once a round is revealed (it
 * strips them only while the question is open), but sends a player only their
 * OWN row in `current_answers`. So totals must come from the server counts;
 * counting `current_answers` is only correct for the host. When counts are
 * absent (older server, or a player while active), `classWide` is false and a
 * player must not be shown totals at all.
 */
export function revealTotals(answers: AnswerWithCount[] | undefined, currentAnswers: AnswerRow[], isHost: boolean): RevealTotals {
  const list = answers ?? [];
  const serverCounts = list.length > 0 && list.every((answer) => typeof answer.count === "number");
  if (serverCounts) {
    const answerCounts = list.map((answer) => ({ ...answer, count: answer.count as number }));
    const total = answerCounts.reduce((sum, answer) => sum + answer.count, 0);
    const correct = answerCounts.filter((answer) => answer.is_correct).reduce((sum, answer) => sum + answer.count, 0);
    return { answerCounts, correct, total, classWide: true };
  }
  const answerCounts = list.map((answer) => ({
    ...answer,
    count: currentAnswers.filter((row) => row.answer_id === answer.id).length,
  }));
  return {
    answerCounts,
    correct: currentAnswers.filter((row) => row.is_correct).length,
    total: currentAnswers.length,
    classWide: isHost,
  };
}

import type { CurrentAnswer, GamePlayer, QuestionHistoryEntry } from "@/lib/game/session-normalizers";

export type PlayerAchievement = { emoji: string; label: string };

export function countCorrectAnswersByPlayer(
  questionHistory: QuestionHistoryEntry[],
  currentAnswers: CurrentAnswer[],
  includeCurrentReveal: boolean
) {
  const counts: Record<string, number> = {};

  for (const historyEntry of questionHistory) {
    for (const response of historyEntry.responses ?? []) {
      if (response.is_correct) counts[response.player_id] = (counts[response.player_id] || 0) + 1;
    }
  }

  if (includeCurrentReveal) {
    for (const answer of currentAnswers) {
      if (answer.is_correct) counts[answer.player_id] = (counts[answer.player_id] || 0) + 1;
    }
  }

  return counts;
}

export function sortLeaderboard(players: GamePlayer[]) {
  return [...players].sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
}

export function calculatePlayerAchievements({
  players,
  playerCorrectCounts,
  playerStreaks,
  questionHistory,
  leaderboard,
  totalQuestions,
}: {
  players: GamePlayer[];
  playerCorrectCounts: Record<string, number>;
  playerStreaks: Record<string, number>;
  questionHistory: QuestionHistoryEntry[];
  leaderboard: GamePlayer[];
  totalQuestions: number;
}) {
  const result: Record<string, PlayerAchievement[]> = {};

  for (const player of players) {
    const badges: PlayerAchievement[] = [];
    const correctCount = playerCorrectCounts[player.id] ?? 0;
    const streak = playerStreaks[player.id] ?? 0;

    if (correctCount >= 3 && totalQuestions > 0 && correctCount === totalQuestions) {
      badges.push({ emoji: "🧠", label: "Perfect Score" });
    }
    if (streak >= 3) badges.push({ emoji: "🔥", label: `On Fire (${streak})` });
    if (streak >= 5) badges.push({ emoji: "⚡", label: "Unstoppable" });

    const bestTime = questionHistory.reduce((best, historyEntry) => {
      const response = historyEntry.responses?.find((entry) => entry.player_id === player.id);
      return response ? Math.min(best, response.response_time_ms) : best;
    }, Infinity);

    if (bestTime < 3000 && bestTime < Infinity) badges.push({ emoji: "⚡", label: "Speed Demon" });

    const rank = leaderboard.findIndex((entry) => entry.id === player.id);
    if (rank === 0 && players.length >= 2) badges.push({ emoji: "🏆", label: "Champion" });

    result[player.id] = badges;
  }

  return result;
}

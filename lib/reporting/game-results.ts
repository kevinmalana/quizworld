export type GameResultRow = {
  id: string;
  pin: string;
  quiz_id: string;
  host_id: string | null;
  player_count: number | null;
  finished_at: string;
  results: {
    players?: Array<{
      id?: string;
      nickname?: string;
      avatar?: string | null;
      score?: number;
    }>;
    question_count?: number;
    finished_status?: string;
  } | null;
};

export function getHostedGameCount(results: GameResultRow[]) {
  return results.length;
}

export function getTotalHostedPlayers(results: GameResultRow[]) {
  return results.reduce((sum, result) => sum + (result.player_count ?? 0), 0);
}

export function getBestHostedScore(results: GameResultRow[]) {
  return results.reduce((best, result) => {
    const topScore = Math.max(
      0,
      ...(result.results?.players?.map((player) => player.score ?? 0) ?? [0])
    );

    return Math.max(best, topScore);
  }, 0);
}

export function getRecentHostedResults(results: GameResultRow[], limit = 5) {
  return [...results]
    .sort(
      (left, right) =>
        new Date(right.finished_at).getTime() - new Date(left.finished_at).getTime()
    )
    .slice(0, limit);
}

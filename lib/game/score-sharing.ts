type ScorePlayer = {
  id: string;
  score?: number;
};

type ScoreTeam = {
  score: number;
};

export function buildScoreShareText({
  gameMode,
  leaderboard,
  currentPlayerId,
  teams,
  myTeamId,
}: {
  gameMode: string;
  leaderboard: ScorePlayer[];
  currentPlayerId: string | null;
  teams: Record<string, ScoreTeam>;
  myTeamId: string | null;
}) {
  if (gameMode === "team" && myTeamId && teams[myTeamId]) {
    return `My team scored ${teams[myTeamId].score.toLocaleString()} points on QuizWorld! Play at quizworld.xyz`;
  }

  const currentPlayer = currentPlayerId
    ? leaderboard.find((player) => player.id === currentPlayerId)
    : null;

  if (currentPlayer) {
    return `I scored ${(currentPlayer.score ?? 0).toLocaleString()} points on QuizWorld! Play at quizworld.xyz`;
  }

  const winningScore = leaderboard[0]?.score ?? 0;
  return `The winning score was ${winningScore.toLocaleString()} points on QuizWorld! Play at quizworld.xyz`;
}

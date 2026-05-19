import type { GamePlayer } from "@/lib/game/session-normalizers";

export function LeaderboardList({
  leaderboard,
  playerStreaks,
  playerAchievements,
  playerCorrectCounts,
  totalQuestions,
}: {
  leaderboard: GamePlayer[];
  playerStreaks: Record<string, number>;
  playerAchievements: Record<string, { label: string; emoji: string }[]>;
  playerCorrectCounts: Record<string, number>;
  totalQuestions: number;
}) {
  return (
    <div>
      <h3 className="game-leaderboard-title">Leaderboard</h3>
      <div className="game-leaderboard-list">
        {leaderboard.map((player, index) => (
          <div key={player.id} className="game-leaderboard-row">
            <span className="game-leaderboard-name">
              {index + 1}. {player.avatar || "🎮"} {player.nickname}
              {(playerStreaks[player.id] ?? 0) >= 2 && (
                <span className="game-leaderboard-streak">🔥{playerStreaks[player.id]}</span>
              )}
              {(playerAchievements[player.id] ?? []).map((badge, bi) => (
                <span key={bi} className="game-leaderboard-badge" title={badge.label}>
                  {badge.emoji}
                </span>
              ))}
            </span>
            <span className="game-leaderboard-score">
              {playerCorrectCounts[player.id] ?? 0}/{totalQuestions} ✓ · {(player.score ?? 0).toLocaleString()} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

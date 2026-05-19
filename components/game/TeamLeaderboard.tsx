import type { GamePlayer } from "@/lib/game/session-normalizers";
import type { Team } from "./TeamScoreBar";

export function TeamLeaderboard({
  teams,
  players,
  teamAssignments,
}: {
  teams: Record<string, Team>;
  players: GamePlayer[];
  teamAssignments: Record<string, string>;
}) {
  const teamList = Object.values(teams).sort((a, b) => b.score - a.score);

  return (
    <div className="team-leaderboard">
      <h3 className="game-leaderboard-title">Team Scores</h3>
      {teamList.map((team, i) => {
        const teamPlayers = players.filter(p => teamAssignments[p.id] === team.id);
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
        return (
          <div key={team.id} className="team-lb-row" style={{ borderColor: team.color }}>
            <div className="team-lb-header">
              <span>{medal} {team.emoji} {team.name}</span>
              <span className="team-lb-score" style={{ color: team.color }}>
                {team.score.toLocaleString()} pts
              </span>
            </div>
            <div className="team-lb-players">
              {teamPlayers.map(p => (
                <span key={p.id} className="team-lb-player">
                  {p.avatar || "🎮"} {p.nickname}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

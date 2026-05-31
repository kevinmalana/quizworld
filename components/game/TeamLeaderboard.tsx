import type { GamePlayer } from "@/lib/game/session-normalizers";
import type { Team } from "./TeamScoreBar";

export function TeamLeaderboard({
  teams,
  players,
  teamAssignments,
  myTeamId,
}: {
  teams: Record<string, Team>;
  players: GamePlayer[];
  teamAssignments: Record<string, string>;
  myTeamId?: string | null;
}) {
  const teamList = Object.values(teams).sort((a, b) => b.score - a.score);

  return (
    <div className="team-leaderboard">
      <h3 className="game-leaderboard-title">Team Scores</h3>
      {teamList.map((team, i) => {
        const teamPlayers = players.filter(p => teamAssignments[p.id] === team.id);
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
        const isMyTeam = myTeamId && team.id === myTeamId;
        return (
          <div key={team.id} className={`team-lb-row${isMyTeam ? " team-lb-row--mine" : ""}`} style={{ borderColor: team.color, outline: isMyTeam ? `2px solid ${team.color}` : undefined }}>
            <div className="team-lb-header">
              <span>{medal} {team.emoji} {team.name}</span>
              <span className="team-lb-score" style={{ color: team.color }}>
                {team.score.toLocaleString()} pts
              </span>
              {isMyTeam && <span className="team-lb-you">⭐ Your team</span>}
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

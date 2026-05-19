export type Team = { id: string; name: string; color: string; emoji: string; score: number };

export function TeamScoreBar({
  teams,
  myTeamId,
}: {
  teams: Record<string, Team>;
  myTeamId: string | null;
}) {
  const teamList = Object.values(teams).sort((a, b) => b.score - a.score);
  const maxScore = Math.max(...teamList.map(t => t.score), 1);

  return (
    <div className="team-score-bar">
      {teamList.map((team, i) => (
        <div
          key={team.id}
          className={`team-score-row${team.id === myTeamId ? " team-score-row--mine" : ""}`}
        >
          <span className="team-score-rank">#{i + 1}</span>
          <span className="team-score-emoji">{team.emoji}</span>
          <span className="team-score-name">{team.name}</span>
          <div className="team-score-track">
            <div
              className="team-score-fill"
              style={{
                width: `${(team.score / maxScore) * 100}%`,
                background: team.color,
              }}
            />
          </div>
          <span className="team-score-pts">{team.score.toLocaleString()}</span>
          {team.id === myTeamId && <span className="team-score-you">← You</span>}
        </div>
      ))}
    </div>
  );
}

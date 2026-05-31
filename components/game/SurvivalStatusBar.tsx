export function SurvivalStatusBar({
  aliveCount,
  totalPlayers,
  eliminated,
  myPlayerId,
}: {
  aliveCount: number;
  totalPlayers: number;
  eliminated: string[];
  myPlayerId: string | null;
}) {
  const isEliminated = myPlayerId ? eliminated.includes(myPlayerId) : false;

  return (
    <div className={`survival-status-bar${isEliminated ? " survival-status-bar--out" : ""}`}>
      {isEliminated ? (
        <div className="survival-eliminated-banner">
          <span className="survival-eliminated-icon">💀</span>
          <div>
            <div className="survival-eliminated-title">You&apos;re Out!</div>
            <div className="survival-eliminated-sub">
              {aliveCount > 0
                ? `${aliveCount} player${aliveCount !== 1 ? "s" : ""} still fighting — watch the action!`
                : "Everyone's been eliminated!"}
            </div>
          </div>
        </div>
      ) : (
        <>
          <span className="survival-alive-icon">💚</span>
          <span className="survival-alive-label">
            <strong>{aliveCount}</strong> player{aliveCount !== 1 ? "s" : ""} still alive
          </span>
          <div className="survival-alive-bar">
            <div
              className="survival-alive-fill"
              style={{ width: `${(aliveCount / Math.max(totalPlayers, 1)) * 100}%` }}
            />
          </div>
          <span className="survival-total">{totalPlayers} total</span>
        </>
      )}
    </div>
  );
}

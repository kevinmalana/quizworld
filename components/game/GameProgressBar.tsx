export function GameProgressBar({
  currentIndex,
  totalQuestions,
  compact = false,
}: {
  currentIndex: number;
  totalQuestions: number;
  compact?: boolean;
}) {
  const pct = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;
  return (
    <div className="game-progress-wrapper">
      {!compact && (
        <div className="game-progress-meta">
          <span>Question {currentIndex + 1} of {totalQuestions}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className="game-progress-track">
        <div className="game-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

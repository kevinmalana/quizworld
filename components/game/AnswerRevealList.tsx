import type { GameAnswer } from "@/lib/game/session-normalizers";

export function AnswerRevealList({
  answerCounts,
  showCounts = true,
  ownAnswerId = null,
}: {
  answerCounts: (GameAnswer & { count: number; image_url?: string | null })[];
  showCounts?: boolean;
  ownAnswerId?: string | null;
}) {
  return (
    <div className="game-reveal-list">
      {answerCounts.map((answer, index) => (
        <div
          key={answer.id}
          className={`game-reveal-item${answer.is_correct ? " is-correct" : ""}${ownAnswerId === answer.id ? " is-own" : ""}`}
        >
          <span className="game-reveal-label">
            {answer.is_correct ? "✅" : `${String.fromCharCode(65 + index)}.`} {answer.text}
            {answer.image_url && <img src={answer.image_url} alt="" className="game-reveal-img" />}
            {ownAnswerId === answer.id && <span className="game-reveal-own">Your answer</span>}
          </span>
          {showCounts && (
            <span className="game-reveal-count">{answer.count} answer{answer.count !== 1 ? "s" : ""}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function RevealStatsLine({
  isPoll,
  isHost,
  correctCount,
  totalAnswered,
}: {
  isPoll: boolean;
  isHost: boolean;
  correctCount: number;
  totalAnswered: number;
}) {
  if (isPoll) {
    return <div className="game-stats-bar">Opinions have no right or wrong answer.</div>;
  }
  if (!isHost) return null;
  return (
    <div className="game-stats-bar">
      {`${correctCount}/${totalAnswered} correct (${totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0}%)`}
    </div>
  );
}

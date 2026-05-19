import type { GameAnswer } from "@/lib/game/session-normalizers";

export function AnswerRevealList({
  answerCounts,
}: {
  answerCounts: (GameAnswer & { count: number; image_url?: string | null })[];
}) {
  return (
    <div className="game-reveal-list">
      {answerCounts.map((answer, index) => (
        <div key={answer.id} className={`game-reveal-item${answer.is_correct ? " is-correct" : ""}`}>
          <span className="game-reveal-label">
            {answer.is_correct ? "✅" : `${String.fromCharCode(65 + index)}.`} {answer.text}
            {answer.image_url && <img src={answer.image_url} alt="" className="game-reveal-img" />}
          </span>
          <span className="game-reveal-votes">{answer.count} vote{answer.count !== 1 ? "s" : ""}</span>
        </div>
      ))}
    </div>
  );
}

import type { GameAnswer, GameQuestion } from "@/lib/game/session-normalizers";

type GameAnswerWithMedia = GameAnswer & { image_url?: string | null };

export function PlayerAnswerGrid({
  currentQuestion,
  selectedAnswer,
  submittingAnswer,
  timeLeft,
  onSubmit,
  myTeam,
}: {
  currentQuestion: GameQuestion;
  selectedAnswer: string | null;
  submittingAnswer: boolean;
  timeLeft: number;
  onSubmit: (answer: { id: string }) => void;
  myTeam?: { name: string; color: string; emoji: string } | null;
}) {
  const locked = selectedAnswer !== null || submittingAnswer || timeLeft <= 0;

  return (
    <div className="game-answer-grid">
      {myTeam && (
        <div className="game-my-team-badge" style={{ borderColor: myTeam.color, color: myTeam.color, background: `${myTeam.color}15` }}>
          {myTeam.emoji} Your team: <strong>{myTeam.name}</strong>
        </div>
      )}
      {currentQuestion.answers?.map((answer, index) => {
        const a = answer as GameAnswerWithMedia;
        const selected = selectedAnswer === answer.id;
        return (
          <button
            key={answer.id}
            onClick={() => onSubmit(answer)}
            disabled={locked}
            className={`game-answer-btn${selected ? " is-selected" : ""}`}
          >
            <span className="game-answer-badge">{String.fromCharCode(65 + index)}</span>
            {a.image_url && <img src={a.image_url} alt="" className="game-answer-img" />}
            {answer.text}
          </button>
        );
      })}
    </div>
  );
}

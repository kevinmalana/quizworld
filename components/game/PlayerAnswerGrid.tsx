import type { GameAnswer, GameQuestion } from "@/lib/game/session-normalizers";

type GameAnswerWithMedia = GameAnswer & { image_url?: string | null };

export function PlayerAnswerGrid({
  currentQuestion,
  selectedAnswer,
  submittingAnswer,
  timeLeft,
  onSubmit,
  myTeam,
  answerAccepted = false,
}: {
  currentQuestion: GameQuestion;
  selectedAnswer: string | null;
  submittingAnswer: boolean;
  timeLeft: number;
  onSubmit: (answer: { id: string }) => void;
  answerAccepted?: boolean;
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
            aria-pressed={selected}
            className={`game-answer-btn${selected ? " is-selected" : ""}`}
          >
            <span className="game-answer-badge">{String.fromCharCode(65 + index)}</span>
            {a.image_url && <img src={a.image_url} alt="" className="game-answer-img" />}
            <span className="game-answer-text">{answer.text}</span>
          </button>
        );
      })}
      <p className="game-answer-guidance" role="status">{submittingAnswer ? 'Sending your answer…'
        : answerAccepted ? 'Answer locked. Waiting for the reveal.'
        : selectedAnswer !== null ? 'Answer not yet confirmed. Checking with the game server.'
        : timeLeft <= 0 ? 'Time’s up. Waiting for the reveal.' : 'Choose one answer. Your choice submits immediately.'}</p>
    </div>
  );
}

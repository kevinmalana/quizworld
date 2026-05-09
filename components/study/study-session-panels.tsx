import type { CardState, SessionResult, StudyMode, StudyQuestion } from "@/lib/study/types";

const ANSWER_SURFACES = [
  { surface: "#fce7f3", border: "#ec4899", iconBg: "#ec4899" },
  { surface: "#dbeafe", border: "#2563eb", iconBg: "#2563eb" },
  { surface: "#fef3c7", border: "#d97706", iconBg: "#d97706" },
  { surface: "#d1fae5", border: "#059669", iconBg: "#059669" },
];

export function StudyLoadingState({ message }: { message: string }) {
  return <div className="container study-centered-state">{message}</div>;
}

export function StudyResultPanel({
  result,
  mode,
  saving,
  saveMessage,
  onReset,
  onBack,
}: {
  result: SessionResult;
  mode: StudyMode;
  saving: boolean;
  saveMessage: string;
  onReset: () => void;
  onBack: () => void;
}) {
  const pct = Math.round((result.correct / Math.max(result.total, 1)) * 100);
  const xpPerCorrect = mode === "quickfire" ? 45 : 25;
  const completionBonus = result.correct === result.total && result.total > 0 ? 50 : 0;
  const perfectBonus = result.correct === result.total && result.total > 0 ? 100 : 0;
  const sessionXp = result.correct * xpPerCorrect + completionBonus + perfectBonus;

  return (
    <div className="container study-result-shell">
      <div className="card study-result-card">
        <div className="study-result-emoji">{pct === 100 ? "🏆" : pct >= 70 ? "🎉" : "💪"}</div>
        <h2 className="font-display study-result-title">Session Complete</h2>
        <div className="study-result-score" style={{ color: pct >= 70 ? "var(--success)" : "var(--primary)" }}>{pct}%</div>
        <p className="study-muted study-result-copy">{result.correct} out of {result.total} correct</p>
        {sessionXp > 0 && (
          <div className="study-xp-pill">
            <span>⭐</span>
            <span>+{sessionXp} XP earned</span>
          </div>
        )}
        {pct === 100 && <div className="study-perfect-copy">Perfect score! +100 bonus XP ⚡</div>}
        <p className="study-muted study-save-message">{saving ? "Saving progress..." : saveMessage}</p>
        <div className="study-action-row">
          <button onClick={onReset} className="btn btn-primary">Study Again</button>
          <button onClick={onBack} className="btn btn-secondary">Back to Study</button>
        </div>
      </div>
    </div>
  );
}

export function StudyModeChooser({ title, questionCount, onBack, onChoose }: { title: string; questionCount: number; onBack: () => void; onChoose: (mode: StudyMode) => void }) {
  return (
    <div className="container study-mode-shell">
      <button onClick={onBack} className="study-link-button">← Back</button>
      <h1 className="font-display study-mode-title">{title}</h1>
      <p className="study-muted study-mode-count">{questionCount} questions</p>
      <div className="study-mode-grid">
        <StudyModeButton icon="🃏" title="Flashcards" description="Reveal each prompt and answer at your own pace." onClick={() => onChoose("flashcard")} />
        <StudyModeButton icon="⚡" title="Quick Fire" description="Answer against the clock using each question's timer." onClick={() => onChoose("quickfire")} />
      </div>
    </div>
  );
}

function StudyModeButton({ icon, title, description, onClick }: { icon: string; title: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card card-hover study-mode-card">
      <div className="study-mode-icon">{icon}</div>
      <div className="study-mode-card-title">{title}</div>
      <div className="study-muted">{description}</div>
    </button>
  );
}

export function QuickFirePanel({
  question,
  currentIndex,
  totalQuestions,
  correctCount,
  answeredCount,
  timeLeft,
  advancing,
  lastAnswerCorrect,
  onExit,
  onAnswer,
}: {
  question: StudyQuestion;
  currentIndex: number;
  totalQuestions: number;
  correctCount: number;
  answeredCount: number;
  timeLeft: number;
  advancing: boolean;
  lastAnswerCorrect: boolean | null;
  onExit: () => void;
  onAnswer: (correct: boolean) => void;
}) {
  return (
    <div className="container study-play-shell">
      <StudyPlayHeader onExit={onExit} right={<><div className="study-correct-count">✅ {correctCount} / {answeredCount}</div><div className="study-progress-count">{currentIndex + 1} / {totalQuestions}</div></>} />
      <div className="study-timer-wrap">
        <div className="study-timer" style={{ background: timeLeft <= 5 ? "var(--primary)" : "var(--accent)" }}>{timeLeft}</div>
        <AnswerFeedback correct={lastAnswerCorrect} advancing={advancing} />
      </div>
      <div className="card study-question-card"><h2>{question.text}</h2></div>
      <AnswerGrid question={question} advancing={advancing} onAnswer={onAnswer} />
    </div>
  );
}

export function FlashcardPanel({
  question,
  cardState,
  currentIndex,
  totalQuestions,
  correctCount,
  answeredCount,
  advancing,
  lastAnswerCorrect,
  onExit,
  onFlip,
  onAnswer,
}: {
  question: StudyQuestion;
  cardState: CardState;
  currentIndex: number;
  totalQuestions: number;
  correctCount: number;
  answeredCount: number;
  advancing: boolean;
  lastAnswerCorrect: boolean | null;
  onExit: () => void;
  onFlip: () => void;
  onAnswer: (correct: boolean) => void;
}) {
  return (
    <div className="container study-play-shell">
      <StudyPlayHeader onExit={onExit} right={<div className="study-progress-count">{currentIndex + 1} / {totalQuestions}</div>} />
      <FlashCard question={question} cardState={cardState} onFlip={onFlip} onAnswer={onAnswer} index={currentIndex} total={totalQuestions} />
      <div className="study-flash-score">
        <div className="study-score-row">
          <div className="study-correct-count">✅ {correctCount}</div>
          <div className="study-score-divider">/</div>
          <div className="study-wrong-count">❌ {answeredCount - correctCount}</div>
        </div>
        <AnswerFeedback correct={lastAnswerCorrect} advancing={advancing} />
      </div>
    </div>
  );
}

function StudyPlayHeader({ onExit, right }: { onExit: () => void; right: React.ReactNode }) {
  return (
    <div className="study-play-header">
      <button onClick={onExit} className="study-link-button">← Exit</button>
      <div className="study-play-header__right">{right}</div>
    </div>
  );
}

function FlashCard({ question, cardState, onFlip, onAnswer, index, total }: { question: StudyQuestion; cardState: CardState; onFlip: () => void; onAnswer: (correct: boolean) => void; index: number; total: number }) {
  return (
    <div className="study-flashcard-perspective">
      <div onClick={onFlip} className="study-flashcard" style={{ transform: cardState === "back" ? "rotateY(180deg)" : "rotateY(0deg)" }}>
        <div className="study-flashcard-face">
          <div className="card study-flashcard-card study-flashcard-card--front">
            <div className="study-muted study-flashcard-count">Question {index + 1} of {total}</div>
            {question.image_url && <img src={question.image_url} alt="" className="study-question-image" />}
            <div className="study-flashcard-question">{question.text}</div>
            <div className="study-muted study-flashcard-hint">Tap to reveal answers</div>
          </div>
        </div>
        <div className="study-flashcard-face study-flashcard-face--back">
          <div className="card study-flashcard-card">
            <div className="study-flashcard-answer-title">Select the correct answer:</div>
            <AnswerGrid question={question} onAnswer={onAnswer} stopPropagation />
          </div>
        </div>
      </div>
    </div>
  );
}

function AnswerGrid({ question, advancing = false, stopPropagation = false, onAnswer }: { question: StudyQuestion; advancing?: boolean; stopPropagation?: boolean; onAnswer: (correct: boolean) => void }) {
  return (
    <div className="study-answer-grid">
      {question.answers?.map((answer, index) => {
        const surface = ANSWER_SURFACES[index % ANSWER_SURFACES.length];
        return (
          <button
            key={answer.id}
            onClick={(event) => {
              if (stopPropagation) event.stopPropagation();
              onAnswer(answer.is_correct);
            }}
            disabled={advancing}
            className="study-answer-button"
            style={{
              borderColor: stopPropagation ? surface.border : "var(--line)",
              background: stopPropagation ? surface.surface : "var(--surface)",
              cursor: advancing ? "default" : "pointer",
            }}
          >
            <span className="study-answer-letter" style={{ background: stopPropagation ? surface.iconBg : "var(--bg)", color: stopPropagation ? "#fff" : "var(--muted)" }}>{String.fromCharCode(65 + index)}</span>
            {answer.text}
          </button>
        );
      })}
    </div>
  );
}

function AnswerFeedback({ correct, advancing }: { correct: boolean | null; advancing: boolean }) {
  if (correct === null || advancing) return null;
  return <div className="study-answer-feedback" style={{ color: correct ? "var(--success)" : "#ef4444" }}>{correct ? "✅ Correct!" : "❌ Wrong!"}</div>;
}

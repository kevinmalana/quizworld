import { useMemo } from "react";
import type { CardState, SessionResult, StudyMode, StudyQuestion } from "@/lib/study/types";
import { calculateStudyXp } from "@/lib/study/session";

// ─── Level system ─────────────────────────────────────────────────────────────

const LEVEL_TITLES: Record<number, string> = {
  1:  "Curious Learner",
  2:  "Quiz Starter",
  3:  "Knowledge Seeker",
  4:  "Trivia Enthusiast",
  5:  "Quiz Apprentice",
  6:  "Study Scout",
  7:  "Brain Trainer",
  8:  "Quiz Adept",
  9:  "Knowledge Builder",
  10: "Trivia Tactician",
  11: "Quiz Specialist",
  12: "Study Champion",
  13: "Knowledge Expert",
  14: "Quiz Virtuoso",
  15: "Master Learner",
  20: "Quiz Legend",
  25: "Grand Scholar",
  30: "Trivia Grandmaster",
};

export function getLevelTitle(level: number): string {
  // Find the highest matching threshold
  const keys = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a);
  for (const k of keys) {
    if (level >= k) return LEVEL_TITLES[k];
  }
  return "Curious Learner";
}

export function calcLevel(totalXp: number) {
  let level = 1;
  let xpNeeded = 200;
  while (totalXp >= xpNeeded) {
    level++;
    xpNeeded += level * 200;
  }
  const levelStartXp = (level - 1) * level * 100;
  const levelEndXp   = level * (level + 1) * 100;
  const xpInLevel    = totalXp - levelStartXp;
  const xpForLevel   = levelEndXp - levelStartXp;
  const progress     = Math.min(100, Math.max(0, (xpInLevel / xpForLevel) * 100));
  return {
    level,
    title: getLevelTitle(level),
    progress,
    xpInLevel,
    xpForLevel,
    xpToNext: levelEndXp - totalXp,
  };
}

function MiniXpBar({ totalXp, newXp }: { totalXp: number; newXp: number }) {
  const before = useMemo(() => calcLevel(Math.max(0, totalXp - newXp)), [totalXp, newXp]);
  const after  = useMemo(() => calcLevel(totalXp), [totalXp]);
  const leveledUp = after.level > before.level;

  return (
    <div className="study-mini-xp-bar">
      {leveledUp && (
        <div className="study-levelup-banner">
          🎉 Level Up! You reached <strong>Level {after.level} — {after.title}</strong>!
        </div>
      )}
      <div className="study-mini-xp-header">
        <span className="study-mini-xp-level">⭐ Level {after.level} <span className="study-mini-xp-title">{after.title}</span></span>
        <span className="study-mini-xp-count">{after.xpInLevel.toLocaleString()} / {after.xpForLevel.toLocaleString()} XP</span>
      </div>
      <div className="study-mini-xp-track">
        <div className="study-mini-xp-fill" style={{ width: `${after.progress}%` }} />
      </div>
      <div className="study-mini-xp-next">{Math.round(after.progress)}% · {after.xpToNext.toLocaleString()} XP to Level {after.level + 1}</div>
    </div>
  );
}

// ─── Colours ─────────────────────────────────────────────────────────────────

const ANSWER_SURFACES = [
  { surface: "#fce7f3", border: "#ec4899", iconBg: "#ec4899" },
  { surface: "#dbeafe", border: "#2563eb", iconBg: "#2563eb" },
  { surface: "#fef3c7", border: "#d97706", iconBg: "#d97706" },
  { surface: "#d1fae5", border: "#059669", iconBg: "#059669" },
];

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function StudyLoadingState({ message }: { message: string }) {
  return <div className="container study-centered-state">{message}</div>;
}

function StudyPlayHeader({ onExit, right }: { onExit: () => void; right: React.ReactNode }) {
  return (
    <div className="study-play-header">
      <button onClick={onExit} className="study-link-button">← Exit</button>
      <div className="study-play-header__right">{right}</div>
    </div>
  );
}

function AnswerFeedback({ correct, advancing }: { correct: boolean | null; advancing: boolean }) {
  // Keep feedback visible during advancing (don't hide it while waiting to advance)
  if (correct === null) return null;
  return (
    <div className={`study-answer-feedback${advancing ? " is-advancing" : ""}`} style={{ color: correct ? "var(--success)" : "#ef4444" }}>
      {correct ? "✅ Correct!" : "❌ Wrong!"}
    </div>
  );
}

function ExplanationBox({ question, show }: { question: StudyQuestion; show: boolean }) {
  if (!show) return null;
  const correct = question.answers?.find((a) => a.is_correct);
  // Always show correct answer; explanation text is optional
  if (!correct && !question.explanation) return null;
  return (
    <div className="study-explanation-box">
      <div className="study-explanation-label">💡 Answer</div>
      {correct && <div className="study-explanation-answer">✅ {correct.text}</div>}
      {question.explanation && <div className="study-explanation-text">{question.explanation}</div>}
    </div>
  );
}

function AnswerGrid({
  question,
  advancing = false,
  stopPropagation = false,
  showCorrect = false,
  onAnswer,
}: {
  question: StudyQuestion;
  advancing?: boolean;
  stopPropagation?: boolean;
  showCorrect?: boolean;
  onAnswer: (correct: boolean, answerId: string) => void;
}) {
  return (
    <div className="study-answer-grid">
      {question.answers?.map((answer, index) => {
        const s = ANSWER_SURFACES[index % ANSWER_SURFACES.length];
        const isCorrect = answer.is_correct;
        const highlight = showCorrect && isCorrect;
        return (
          <button
            key={answer.id}
            onClick={(e) => {
              if (stopPropagation) e.stopPropagation();
              onAnswer(answer.is_correct, answer.id);
            }}
            disabled={advancing}
            className={`study-answer-button${highlight ? " is-correct-reveal" : ""}`}
            style={{
              borderColor: stopPropagation ? s.border : "var(--line)",
              background: stopPropagation ? s.surface : "var(--surface)",
              cursor: advancing ? "default" : "pointer",
            }}
          >
            <span
              className="study-answer-letter"
              style={{ background: stopPropagation ? s.iconBg : "var(--bg)", color: stopPropagation ? "#fff" : "var(--muted)" }}
            >
              {String.fromCharCode(65 + index)}
            </span>
            {answer.text}
          </button>
        );
      })}
    </div>
  );
}

// ─── Mode chooser ─────────────────────────────────────────────────────────────

export function StudyModeChooser({
  title,
  questionCount,
  onBack,
  onChoose,
}: {
  title: string;
  questionCount: number;
  onBack: () => void;
  onChoose: (mode: "flashcard" | "quickfire") => void;
}) {
  return (
    <div className="container study-mode-shell">
      <button onClick={onBack} className="study-link-button">← Back</button>
      <h1 className="font-display study-mode-title">{title}</h1>
      <p className="study-muted study-mode-count">{questionCount} questions</p>
      <div className="study-mode-grid">
        <StudyModeCard
          icon="🃏"
          title="Flashcards"
          description="See the question, recall the answer, then flip to check."
          onClick={() => onChoose("flashcard")}
        />
        <StudyModeCard
          icon="⚡"
          title="Quick Fire"
          description="Answer against the clock — each question has a timer."
          onClick={() => onChoose("quickfire")}
        />
      </div>
    </div>
  );
}

function StudyModeCard({ icon, title, description, onClick }: { icon: string; title: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card card-hover study-mode-card">
      <div className="study-mode-icon">{icon}</div>
      <div className="study-mode-card-title">{title}</div>
      <div className="study-muted">{description}</div>
    </button>
  );
}

// ─── Flashcard ────────────────────────────────────────────────────────────────

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
  onAnswer: (correct: boolean, answerId: string) => void;
}) {
  const isBack = cardState === "back";
  const answered = lastAnswerCorrect !== null;

  return (
    <div className="container study-play-shell">
      <StudyPlayHeader
        onExit={onExit}
        right={<div className="study-progress-count">{currentIndex + 1} / {totalQuestions}</div>}
      />

      <div className="study-flashcard-perspective">
        <div
          role={!isBack ? "button" : undefined}
          aria-label={!isBack ? "Reveal answers" : undefined}
          aria-disabled={!isBack ? advancing : undefined}
          tabIndex={!isBack && !advancing ? 0 : -1}
          onClick={(!isBack && !advancing) ? onFlip : undefined}
          onKeyDown={(event) => {
            if (!isBack && !advancing && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              onFlip();
            }
          }}
          className={`study-flashcard${advancing ? " is-advancing" : ""}`}
          style={{ transform: isBack ? "rotateY(180deg)" : "rotateY(0deg)", cursor: (!isBack && !advancing) ? "pointer" : "default" }}
        >
          {/* Front — question only */}
          <div className="study-flashcard-face">
            <div className="card study-flashcard-card study-flashcard-card--front">
              <div className="study-muted study-flashcard-count">Question {currentIndex + 1} of {totalQuestions}</div>
              {question.image_url && (
                <img src={question.image_url} alt="" className="study-question-image" />
              )}
              <div className="study-flashcard-question">{question.text}</div>
              {!advancing && <div className="study-muted study-flashcard-hint">Tap to reveal answers</div>}
            </div>
          </div>

          {/* Back — answer grid + explanation */}
          <div className="study-flashcard-face study-flashcard-face--back">
            <div className="card study-flashcard-card">
              <div className="study-flashcard-answer-title">
                {answered ? (lastAnswerCorrect ? "✅ Nice work!" : "❌ Not quite") : "Select the correct answer:"}
              </div>
              <AnswerGrid question={question} advancing={advancing} stopPropagation onAnswer={onAnswer} />
              {answered && (
                <ExplanationBox question={question} show />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="study-flash-score">
        <div className="study-score-row">
          <div className="study-correct-count">✅ {correctCount}</div>
          <div className="study-score-divider">/</div>
          <div className="study-wrong-count">❌ {answeredCount - correctCount}</div>
        </div>
        {advancing && <div className="study-advancing-hint">Next question loading...</div>}
        {!advancing && <AnswerFeedback correct={lastAnswerCorrect} advancing={advancing} />}
      </div>
    </div>
  );
}

// ─── Quick Fire ───────────────────────────────────────────────────────────────

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
  onContinue,
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
  onAnswer: (correct: boolean, answerId: string) => void;
  onContinue: () => void;
}) {
  const urgentTimer = timeLeft <= 5;

  return (
    <div className="container study-play-shell">
      <StudyPlayHeader
        onExit={onExit}
        right={
          <>
            <div className="study-correct-count">✅ {correctCount} / {answeredCount}</div>
            <div className="study-progress-count">{currentIndex + 1} / {totalQuestions}</div>
          </>
        }
      />

      <div className="study-timer-wrap">
        <div
          className={`study-timer${urgentTimer ? " is-urgent" : ""}${advancing ? " is-paused" : ""}`}
          style={{ background: urgentTimer ? "var(--primary)" : "var(--accent)" }}
        >
          {advancing ? "✓" : timeLeft}
        </div>
        {/* Show feedback while advancing so user sees result before next question */}
        <AnswerFeedback correct={lastAnswerCorrect} advancing={false} />
      </div>

      <div className="card study-question-card">
        <h2>{question.text}</h2>
        {question.image_url && <img src={question.image_url} alt="" className="study-question-image" />}
      </div>

      <AnswerGrid question={question} advancing={advancing} onAnswer={onAnswer} />

      {lastAnswerCorrect !== null && (
        <>
          <ExplanationBox question={question} show />
          <button type="button" className="btn btn-primary btn-lg" onClick={onContinue} autoFocus>
            Continue →
          </button>
        </>
      )}
    </div>
  );
}

// ─── Review round ─────────────────────────────────────────────────────────────

export function StudyReviewPanel({
  question,
  currentIndex,
  totalQuestions,
  correctCount,
  advancing,
  lastAnswerCorrect,
  onExit,
  onAnswer,
}: {
  question: StudyQuestion;
  currentIndex: number;
  totalQuestions: number;
  correctCount: number;
  advancing: boolean;
  lastAnswerCorrect: boolean | null;
  onExit: () => void;
  onAnswer: (correct: boolean, answerId: string) => void;
}) {
  return (
    <div className="container study-play-shell">
      <StudyPlayHeader
        onExit={onExit}
        right={
          <>
            <span className="study-review-badge">🔁 Review</span>
            <div className="study-progress-count">{currentIndex + 1} / {totalQuestions}</div>
          </>
        }
      />

      <div className="card study-question-card study-review-question">
        <div className="study-review-label">You got this wrong — try again:</div>
        <h2>{question.text}</h2>
        {question.image_url && <img src={question.image_url} alt="" className="study-question-image" />}
      </div>

      <AnswerGrid question={question} advancing={advancing} showCorrect={lastAnswerCorrect !== null} onAnswer={onAnswer} />

      {lastAnswerCorrect !== null && (
        <ExplanationBox question={question} show />
      )}

      <div className="study-flash-score">
        <AnswerFeedback correct={lastAnswerCorrect} advancing={advancing} />
      </div>
    </div>
  );
}

// ─── Result screen ────────────────────────────────────────────────────────────

export function StudyResultPanel({
  result,
  mode,
  saving,
  saveMessage,
  totalXp,
  newAchievements = [],
  onReset,
  onReview,
  onBack,
}: {
  result: SessionResult;
  mode: StudyMode;
  saving: boolean;
  saveMessage: string;
  totalXp?: number;
  newAchievements?: string[];
  onReset: () => void;
  onReview?: () => void;
  onBack: () => void;
}) {
  const pct = Math.round((result.correct / Math.max(result.total, 1)) * 100);
  const { xpPerCorrect, correctXp, completionBonus, perfectBonus, totalXp: sessionXp } =
    calculateStudyXp({ mode, correct: result.correct, total: result.total });

  return (
    <div className="container study-result-shell">
      <div className="card study-result-card">
        <div className="study-result-emoji">{pct === 100 ? "🏆" : pct >= 70 ? "🎉" : "💪"}</div>
        <h2 className="font-display study-result-title">Session Complete</h2>
        <div className="study-result-score" style={{ color: pct >= 70 ? "var(--success)" : "var(--primary)" }}>
          {pct}%
        </div>
        <p className="study-muted study-result-copy">{result.correct} out of {result.total} correct</p>

        {/* XP breakdown */}
        {sessionXp > 0 && (
          <div className="study-xp-breakdown">
            <div className="study-xp-breakdown__title">⭐ XP Earned</div>
            <div className="study-xp-breakdown__rows">
              <div className="study-xp-breakdown__row">
                <span>{result.correct} correct × {xpPerCorrect} XP</span>
                <span>+{correctXp}</span>
              </div>
              <div className="study-xp-breakdown__row">
                <span>Completion bonus</span>
                <span>+{completionBonus}</span>
              </div>
              {perfectBonus > 0 && (
                <div className="study-xp-breakdown__row study-xp-breakdown__row--bonus">
                  <span>⚡ Perfect score bonus</span>
                  <span>+{perfectBonus}</span>
                </div>
              )}
              <div className="study-xp-breakdown__row study-xp-breakdown__row--total">
                <span>Total</span>
                <span>+{sessionXp} XP</span>
              </div>
            </div>
          </div>
        )}

        {/* New achievements unlocked */}
        {newAchievements.length > 0 && (
          <div className="study-new-achievements">
            <div className="study-new-achievements__title">🏅 Achievement{newAchievements.length > 1 ? "s" : ""} Unlocked!</div>
            <div className="study-new-achievements__list">
              {newAchievements.map(slug => (
                <span key={slug} className="study-new-achievement-badge">{slug.replace(/_/g, " ")}</span>
              ))}
            </div>
            <a href="/achievements" className="study-new-achievements__link">View all achievements →</a>
          </div>
        )}

        {/* Live level progress bar — shows after save completes */}
        {totalXp !== undefined && !saving && (
          <MiniXpBar totalXp={totalXp} newXp={sessionXp} />
        )}
        {saving && <p className="study-muted study-save-message">Saving progress...</p>}
        {!saving && saveMessage && <p className="study-muted study-save-message">{saveMessage}</p>}

        <div className="study-action-row">
          {onReview && (
            <button onClick={onReview} className="btn btn-primary">
              🔁 Review {result.wrongQuestions.length} Missed
            </button>
          )}
          <button onClick={onReset} className="btn btn-secondary">Study Again</button>
          <button onClick={onBack} className="btn btn-secondary">Back to Study</button>
        </div>
      </div>

      {/* How XP works info box */}
      <div className="card study-xp-how-it-works">
        <div className="study-xp-how-title">💡 How XP works</div>
        <div className="study-xp-how-rows">
          <div className="study-xp-how-row"><span>🇦️ Flashcard correct answer</span><span>25 XP</span></div>
          <div className="study-xp-how-row"><span>⚡ Quick Fire correct answer</span><span>45 XP</span></div>
          <div className="study-xp-how-row"><span>✅ Complete any session</span><span>+50 XP</span></div>
          <div className="study-xp-how-row"><span>🏆 Perfect score</span><span>+100 XP bonus</span></div>
          <div className="study-xp-how-row study-xp-how-row--note"><span>Study daily to keep your streak 🔥 — check the Study dashboard to see your level progress</span></div>
        </div>
      </div>

      {/* Wrong answers breakdown */}
      {result.wrongQuestions.length > 0 && (
        <div className="study-result-breakdown">
          <h3 className="study-breakdown-title">Questions to review ({result.wrongQuestions.length})</h3>
          <div className="study-breakdown-list">
            {result.wrongQuestions.map((q) => {
              const correct = q.answers?.find((a) => a.is_correct);
              return (
                <div key={q.id} className="card study-breakdown-item">
                  <div className="study-breakdown-q">❌ {q.text}</div>
                  {correct && (
                    <div className="study-breakdown-answer">✅ {correct.text}</div>
                  )}
                  {q.explanation && (
                    <div className="study-breakdown-explanation">{q.explanation}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

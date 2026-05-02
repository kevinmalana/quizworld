"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import {
  getStudyAnswerShortcutIndex,
  isEditableShortcutTarget,
} from "@/lib/study-shortcuts";

type StudyMode = "choose" | "flashcard" | "quickfire";
type CardState = "front" | "back";
type SessionResult = { correct: number; total: number };
type StudyQuestion = {
  id: string;
  text: string;
  time_limit?: number | null;
  answers: Array<{
    id: string;
    text: string;
    is_correct: boolean;
  }>;
};

const ANSWER_SURFACES = [
  { surface: "#fce7f3", border: "#ec4899", iconBg: "#ec4899" },
  { surface: "#dbeafe", border: "#2563eb", iconBg: "#2563eb" },
  { surface: "#fef3c7", border: "#d97706", iconBg: "#d97706" },
  { surface: "#d1fae5", border: "#059669", iconBg: "#059669" },
];

function shuffleQuestions<T>(questions: T[]) {
  const cloned = [...questions];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
  }
  return cloned;
}

function FlashCard({
  question,
  cardState,
  onFlip,
  onAnswer,
  index,
  total,
}: {
  question: any;
  cardState: CardState;
  onFlip: () => void;
  onAnswer: (correct: boolean) => void;
  index: number;
  total: number;
}) {
  return (
    <div style={{ perspective: 1000, width: "100%", maxWidth: 560, margin: "0 auto" }}>
      <div
        onClick={onFlip}
        style={{
          transform: cardState === "back" ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 0.6s",
          transformStyle: "preserve-3d",
          cursor: "pointer",
          minHeight: 320,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", width: "100%", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
          <div className="card" style={{ padding: "2rem", textAlign: "center", background: "var(--surface)", border: "2px solid var(--line)" }}>
            <div style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1rem" }}>Question {index + 1} of {total}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)" }}>{question.text}</div>
            <div style={{ marginTop: "2rem", fontSize: "0.875rem", color: "var(--muted)" }}>Tap or press Space to reveal answers</div>
          </div>
        </div>
        <div style={{ position: "absolute", width: "100%", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <div className="card" style={{ padding: "2rem", background: "var(--surface)", border: "2px solid var(--line)" }}>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.5rem", textAlign: "center" }}>Select the correct answer:</div>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {question.answers.map((answer: any, index: number) => (
                <button
                  key={answer.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onAnswer(answer.is_correct);
                  }}
                  style={{
                    padding: "1rem",
                    borderRadius: "var(--radius-lg)",
                    border: "2px solid " + ANSWER_SURFACES[index].border,
                    background: ANSWER_SURFACES[index].surface,
                    textAlign: "left",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: ANSWER_SURFACES[index].iconBg,
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "0.875rem",
                      flex: "0 0 auto",
                    }}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span style={{ flex: 1 }}>{answer.text}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.8rem", fontWeight: 800 }}>
                    {index + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudyPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const quizId = params.id as string;

  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<StudyMode>("choose");
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [sessionScope, setSessionScope] = useState<"all" | "incorrect">("all");
  const [activeQuestions, setActiveQuestions] = useState<StudyQuestion[]>([]);
  const [retryQuestionIds, setRetryQuestionIds] = useState<string[]>([]);
  const [incorrectQuestionIds, setIncorrectQuestionIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardState, setCardState] = useState<CardState>("front");
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [quickFireTimeLeft, setQuickFireTimeLeft] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    async function fetchQuiz() {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*, questions(*, answers(*))")
        .eq("id", quizId)
        .is("archived_at", null)
        .single();

      if (data) {
        const sortedQuestions = [...(data.questions ?? [])].sort(
          (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
        );
        setQuiz({ ...data, questions: sortedQuestions });
        setActiveQuestions(sortedQuestions as StudyQuestion[]);
      } else {
        console.error("Error loading quiz:", error);
      }
      setLoading(false);
    }

    fetchQuiz();
  }, [quizId]);

  const currentQuestion = activeQuestions[currentIndex] ?? null;
  const totalQuestions = activeQuestions.length || quiz?.questions?.length || 0;

  function startSession(nextMode: Exclude<StudyMode, "choose">, scope: "all" | "incorrect" = "all") {
    const baseQuestions = (quiz?.questions ?? []) as StudyQuestion[];
    const scopedQuestions = scope === "incorrect"
      ? baseQuestions.filter((question) => retryQuestionIds.includes(question.id))
      : baseQuestions;

    const orderedQuestions = shuffleEnabled ? shuffleQuestions(scopedQuestions) : [...scopedQuestions];
    setActiveQuestions(orderedQuestions);
    setSessionScope(scope);
    setMode(nextMode);
    setCurrentIndex(0);
    setCardState("front");
    setCorrectCount(0);
    setAnsweredCount(0);
    setSessionResult(null);
    setSaveMessage("");
    setAdvancing(false);
    setQuickFireTimeLeft(0);
    setLastAnswerCorrect(null);
    setIncorrectQuestionIds([]);
  }

  useEffect(() => {
    if (mode !== "quickfire" || !currentQuestion || sessionResult) return;
    setQuickFireTimeLeft(currentQuestion.time_limit ?? 20);
  }, [mode, currentQuestion?.id, sessionResult]);

  useEffect(() => {
    if (mode !== "quickfire" || !currentQuestion || sessionResult || advancing || quickFireTimeLeft <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setQuickFireTimeLeft((timeLeft) => timeLeft - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [advancing, currentQuestion, mode, quickFireTimeLeft, sessionResult]);

  useEffect(() => {
    if (mode !== "quickfire" || !currentQuestion || sessionResult || advancing || quickFireTimeLeft > 0) {
      return;
    }

    void recordAnswer(false);
  }, [advancing, currentQuestion, mode, quickFireTimeLeft, sessionResult]);

  const persistProgress = async (result: SessionResult) => {
    if (!user || !quiz) {
      setSaveMessage("Sign in to save progress across devices.");
      return;
    }

    setSaving(true);
    const mastery = Math.round((result.correct / Math.max(result.total, 1)) * 100);
    const now = new Date().toISOString();

    // ── XP calculation ─────────────────────────────────────────────────────────
    // flashcard: 25 XP/correct + 50 completion bonus + 100 perfect bonus
    // quickfire: 45 XP/correct (25+20) + same bonuses
    const xpPerCorrect = mode === "quickfire" ? 45 : 25;
    const completionBonus = result.correct === result.total && result.total > 0 ? 50 : 0;
    const perfectBonus = result.correct === result.total && result.total > 0 ? 100 : 0;
    const sessionXp = result.correct * xpPerCorrect + completionBonus + perfectBonus;
    // ──────────────────────────────────────────────────────────────────────────

    // Call update_study_streak always (a session with 0 XP still counts for streak).
    // Call increment_xp only when there's XP to award.
    const [progressError, sessionError, streakResult, xpResult] = await Promise.all([
      supabase.from("study_progress").upsert(
        {
          user_id: user.id,
          quiz_id: quiz.id,
          questions_studied: result.total,
          correct: result.correct,
          mastery,
          last_studied: now,
        },
        { onConflict: "user_id,quiz_id" }
      ),
      supabase.from("study_sessions").insert({
        user_id: user.id,
        quiz_id: quiz.id,
        xp_earned: sessionXp,
        correct: result.correct,
        total: result.total,
        study_mode: mode,
        duration_secs: null,
        created_at: now,
      }),
      supabase.rpc("update_study_streak", { user_uuid: user.id }),
      sessionXp > 0
        ? supabase.rpc("increment_xp", { user_uuid: user.id, xp_amount: sessionXp })
        : Promise.resolve({ error: null }),
    ]);

    if (progressError || sessionError) {
      console.error("Error saving study progress:", progressError ?? sessionError);
      setSaveMessage("Could not save progress this time.");
    } else {
      const xpLabel = sessionXp > 0 ? ` +${sessionXp} XP earned` : "";
      setSaveMessage(`Progress saved.${xpLabel}`);
    }
    setSaving(false);
  };

  const finishSession = async (result: SessionResult, nextRetryQuestionIds: string[]) => {
    setRetryQuestionIds(nextRetryQuestionIds);
    setSessionResult(result);
    await persistProgress(result);
  };

  const advanceToNextQuestion = async (nextCorrect: number, nextTotal: number, nextRetryQuestionIds: string[]) => {
    if (currentIndex < totalQuestions - 1) {
      setAdvancing(true);
      window.setTimeout(() => {
        setCurrentIndex((index) => index + 1);
        setCardState("front");
        setAdvancing(false);
      }, 350);
      return;
    }

    await finishSession({ correct: nextCorrect, total: nextTotal }, nextRetryQuestionIds);
  };

  const recordAnswer = async (correct: boolean) => {
    if (advancing || !currentQuestion) return;

    setLastAnswerCorrect(correct);
    const nextCorrect = correctCount + (correct ? 1 : 0);
    const nextTotal = answeredCount + 1;
    const nextIncorrectQuestionIds = correct
      ? incorrectQuestionIds
      : Array.from(new Set([...incorrectQuestionIds, currentQuestion.id]));

    setCorrectCount(nextCorrect);
    setAnsweredCount(nextTotal);
    setIncorrectQuestionIds(nextIncorrectQuestionIds);
    await advanceToNextQuestion(nextCorrect, nextTotal, nextIncorrectQuestionIds);
  };

  useEffect(() => {
    if (mode === "choose" || sessionResult || !currentQuestion) return;

    const handleStudyShortcut = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isEditableShortcutTarget(event.target)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setMode("choose");
        return;
      }

      if (mode === "flashcard" && event.key === " " && cardState === "front") {
        event.preventDefault();
        setCardState("back");
        return;
      }

      const answerIndex = getStudyAnswerShortcutIndex(event.key, currentQuestion.answers?.length ?? 0);
      if (answerIndex === null || advancing) return;
      if (mode === "flashcard" && cardState !== "back") return;

      const answer = currentQuestion.answers?.[answerIndex];
      if (!answer) return;
      event.preventDefault();
      void recordAnswer(answer.is_correct);
    };

    window.addEventListener("keydown", handleStudyShortcut);
    return () => window.removeEventListener("keydown", handleStudyShortcut);
  }, [advancing, cardState, currentQuestion, mode, recordAnswer, sessionResult]);

  const resetSession = () => {
    setCurrentIndex(0);
    setCardState("front");
    setCorrectCount(0);
    setAnsweredCount(0);
    setSessionResult(null);
    setSaveMessage("");
    setAdvancing(false);
    setQuickFireTimeLeft(0);
    setMode("choose");
    setSessionScope("all");
    setActiveQuestions((quiz?.questions ?? []) as StudyQuestion[]);
    setIncorrectQuestionIds([]);
    setLastAnswerCorrect(null);
  };

  if (loading) {
    return <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>Loading quiz...</div>;
  }

  if (!quiz) {
    return <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>Quiz not found</div>;
  }

  if (sessionResult) {
    const pct = Math.round((sessionResult.correct / Math.max(sessionResult.total, 1)) * 100);
    const xpPerCorrect = mode === "quickfire" ? 45 : 25;
    const completionBonus = sessionResult.correct === sessionResult.total && sessionResult.total > 0 ? 50 : 0;
    const perfectBonus = sessionResult.correct === sessionResult.total && sessionResult.total > 0 ? 100 : 0;
    const sessionXp = sessionResult.correct * xpPerCorrect + completionBonus + perfectBonus;
    const missedCount = retryQuestionIds.length;

    return (
      <div className="container" style={{ paddingTop: "4rem", textAlign: "center", maxWidth: 500 }}>
        <div className="card" style={{ padding: "3rem" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>{pct === 100 ? "🏆" : pct >= 70 ? "🎉" : "💪"}</div>
          <h2 className="font-display" style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "1rem" }}>Session Complete</h2>
          <div style={{ fontSize: "3rem", fontWeight: 900, color: pct >= 70 ? "var(--success)" : "var(--primary)", marginBottom: "1rem" }}>{pct}%</div>
          <p style={{ color: "var(--muted)", marginBottom: "0.5rem" }}>
            {sessionResult.correct} out of {sessionResult.total} correct
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <span className="tag">{mode === "quickfire" ? "⚡ Quick Fire" : "🃏 Flashcards"}</span>
            <span className="tag">{shuffleEnabled ? "🔀 Shuffled" : "➡️ In order"}</span>
            {sessionScope === "incorrect" && <span className="tag">🎯 Retry set</span>}
          </div>
          {missedCount > 0 && (
            <div style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
              {missedCount} missed question{missedCount === 1 ? "" : "s"} ready for a focused retry.
            </div>
          )}
          {sessionXp > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderRadius: 999, background: "#f5f3ff", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.1rem" }}>⭐</span>
              <span style={{ fontWeight: 800, color: "#8b5cf6" }}>+{sessionXp} XP earned</span>
            </div>
          )}
          {pct === 100 && (
            <div style={{ fontSize: "0.85rem", color: "var(--success)", fontWeight: 700, marginBottom: "0.75rem" }}>
              Perfect score! +100 bonus XP ⚡
            </div>
          )}
          <p style={{ color: "var(--muted)", marginBottom: "2rem", fontSize: "0.875rem" }}>
            {saving ? "Saving progress..." : saveMessage}
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={resetSession} className="btn btn-primary">
              Study Again
            </button>
            {missedCount > 0 && (
              <button onClick={() => startSession(mode as Exclude<StudyMode, "choose">, "incorrect")} className="btn btn-secondary">
                Retry Missed ({missedCount})
              </button>
            )}
            <button onClick={() => router.push("/study")} className="btn btn-secondary">
              Back to Study
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "choose") {
    const hasRetrySet = retryQuestionIds.length > 0;

    return (
      <div className="container" style={{ paddingTop: "4rem", paddingBottom: "5rem" }}>
        <button onClick={() => router.push("/study")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", marginBottom: "2rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          ← Back
        </button>

        <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>{quiz.title}</h1>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>{quiz.questions?.length || 0} questions</p>

        <div className="card" style={{ padding: "1.25rem", maxWidth: 520, marginBottom: "1rem", border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800, marginBottom: "0.2rem" }}>Session options</div>
              <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                Shuffle question order for a fresher study run.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShuffleEnabled((value) => !value)}
              className="btn btn-secondary"
              style={{ minWidth: 148 }}
            >
              {shuffleEnabled ? "🔀 Shuffle On" : "➡️ In Order"}
            </button>
          </div>
          {hasRetrySet && (
            <div style={{ marginTop: "0.9rem", fontSize: "0.875rem", color: "var(--muted)" }}>
              You still have {retryQuestionIds.length} missed question{retryQuestionIds.length === 1 ? "" : "s"} from your last run.
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: "1rem", maxWidth: 520 }}>
          <button onClick={() => startSession("flashcard")} className="card card-hover" style={{ padding: "2rem", textAlign: "left", cursor: "pointer", border: "2px solid var(--line)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🃏</div>
            <div style={{ fontWeight: 700, fontSize: "1.25rem" }}>Flashcards</div>
            <div style={{ color: "var(--muted)" }}>Reveal each prompt and answer at your own pace.</div>
          </button>

          <button onClick={() => startSession("quickfire")} className="card card-hover" style={{ padding: "2rem", textAlign: "left", cursor: "pointer", border: "2px solid var(--line)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⚡</div>
            <div style={{ fontWeight: 700, fontSize: "1.25rem" }}>Quick Fire</div>
            <div style={{ color: "var(--muted)" }}>Answer against the clock using each question's timer. Use A-D or 1-4 on your keyboard.</div>
          </button>

          {hasRetrySet && (
            <button onClick={() => startSession("flashcard", "incorrect")} className="card card-hover" style={{ padding: "1.5rem 2rem", textAlign: "left", cursor: "pointer", border: "2px dashed var(--line-strong)", background: "linear-gradient(180deg, var(--surface), var(--bg-subtle))" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.35rem" }}>🎯</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>Retry Missed Questions</div>
              <div style={{ color: "var(--muted)" }}>Rebuild confidence on the {retryQuestionIds.length} question{retryQuestionIds.length === 1 ? "" : "s"} you missed last time.</div>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (mode === "quickfire" && currentQuestion) {
    return (
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <button onClick={() => setMode("choose")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
            ← Exit
          </button>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div style={{ color: "var(--muted)", fontSize: "0.8rem", fontWeight: 700 }}>
              Keys: A-D / 1-4 · Esc exits
            </div>
            <div style={{ fontWeight: 700, color: "var(--success)", fontSize: "0.9rem" }}>
              ✅ {correctCount} / {answeredCount}
            </div>
            <div style={{ fontWeight: 700 }}>{currentIndex + 1} / {totalQuestions}</div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "inline-grid",
              placeItems: "center",
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: quickFireTimeLeft <= 5 ? "var(--primary)" : "var(--accent)",
              color: "#fff",
              fontWeight: 900,
              fontSize: "1.75rem",
            }}
          >
            {quickFireTimeLeft}
          </div>
          {lastAnswerCorrect !== null && !advancing && (
            <div style={{ marginTop: "0.75rem", fontSize: "1rem", fontWeight: 800, color: lastAnswerCorrect ? "var(--success)" : "#ef4444" }}>
              {lastAnswerCorrect ? "✅ Correct!" : "❌ Wrong!"}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: "2rem", maxWidth: 680, margin: "0 auto 2rem", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{currentQuestion.text}</h2>
        </div>

        <div style={{ display: "grid", gap: "1rem", maxWidth: 680, margin: "0 auto" }}>
          {currentQuestion.answers?.map((answer: any, index: number) => (
            <button
              key={answer.id}
              onClick={() => void recordAnswer(answer.is_correct)}
              disabled={advancing}
              style={{
                padding: "1.25rem",
                borderRadius: "var(--radius-xl)",
                border: "2px solid var(--line)",
                background: "var(--surface)",
                fontSize: "1.05rem",
                fontWeight: 700,
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                cursor: advancing ? "default" : "pointer",
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "var(--bg)",
                  color: "var(--muted)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 900,
                  flex: "0 0 auto",
                }}
              >
                {String.fromCharCode(65 + index)}
              </span>
              <span style={{ flex: 1 }}>{answer.text}</span>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem", fontWeight: 900 }}>
                {index + 1}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: "2rem", paddingBottom: "5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <button onClick={() => setMode("choose")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
          ← Exit
        </button>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div style={{ color: "var(--muted)", fontSize: "0.8rem", fontWeight: 700 }}>
            Space flips · A-D / 1-4 answer · Esc exits
          </div>
          <div style={{ fontWeight: 700 }}>{currentIndex + 1} / {totalQuestions}</div>
        </div>
      </div>

      {currentQuestion && (
        <FlashCard
          question={currentQuestion}
          cardState={cardState}
          onFlip={() => setCardState((state) => (state === "front" ? "back" : "front"))}
          onAnswer={(correct) => void recordAnswer(correct)}
          index={currentIndex}
          total={totalQuestions}
        />
      )}

      {/* Score display for flashcard mode */}
      <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
        <div style={{ display: "inline-flex", gap: "0.75rem", alignItems: "center" }}>
          <div style={{ fontWeight: 700, color: "var(--success)", fontSize: "0.9rem" }}>
            ✅ {correctCount}
          </div>
          <div style={{ color: "var(--line-strong)", fontWeight: 700 }}>/</div>
          <div style={{ fontWeight: 700, color: "#ef4444", fontSize: "0.9rem" }}>
            ❌ {answeredCount - correctCount}
          </div>
        </div>
        {lastAnswerCorrect !== null && !advancing && (
          <div style={{ marginTop: "0.75rem", fontSize: "1rem", fontWeight: 800, color: lastAnswerCorrect ? "var(--success)" : "#ef4444" }}>
            {lastAnswerCorrect ? "✅ Correct!" : "❌ Wrong!"}
          </div>
        )}
      </div>
    </div>
  );
};

"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { checkAndGrantAchievements } from "@/lib/achievements";

import type { CardState, SessionResult, StudyMode, StudyQuestion, StudyQuiz } from "@/lib/study/types";
import { shouldExpireQuickFireQuestion } from "@/lib/study/session";
import {
  FlashcardPanel,
  QuickFirePanel,
  StudyLoadingState,
  StudyModeChooser,
  StudyResultPanel,
  StudyReviewPanel,
} from "@/components/study/study-session-panels";

export default function StudyPageClient() {
  const params   = useParams();
  const router   = useRouter();
  const { user } = useAuth();
  const quizId   = params.id as string;
  const attemptIdRef = useRef<string>(crypto.randomUUID());
  const submittedAnswersRef = useRef<Array<{ question_id: string; answer_id: string | null }>>([]);

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const [quiz, setQuiz]               = useState<StudyQuiz | null>(null);
  const [loading, setLoading]         = useState(true);
  const [mode, setMode]               = useState<StudyMode>("choose");
  const [questions, setQuestions]     = useState<StudyQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardState, setCardState]     = useState<CardState>("front");
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [wrongQuestions, setWrongQuestions] = useState<StudyQuestion[]>([]);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [saved, setSaved] = useState(false);
  const saveInFlight = useRef(false);
  const recoveryLoaded = useRef(false);
  const completedAttemptRef = useRef<{ result: SessionResult; mode: "flashcard" | "quickfire" } | null>(null);
  const [saving, setSaving]           = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [totalXp, setTotalXp]         = useState<number | undefined>(undefined);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [quickFireTimeLeft, setQuickFireTimeLeft] = useState<number | null>(null);
  const [advancing, setAdvancing]     = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [timerPaused, setTimerPaused] = useState(false);
  const [pendingQuickFireAdvance, setPendingQuickFireAdvance] = useState<{
    correct: number;
    total: number;
    wrong: StudyQuestion[];
  } | null>(null);

  useEffect(() => {
    async function fetchQuiz() {
      const query = UUID_RE.test(quizId)
        ? supabase.from("quizzes").select("*, questions(*, answers(*))").eq("id", quizId).is("archived_at", null).single()
        : supabase.from("quizzes").select("*, questions(*, answers(*))").eq("slug", quizId).is("archived_at", null).single();
      const { data, error } = await query;

      if (data) {
        const sorted = [...(data.questions ?? [])].sort(
          (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
        );
        setQuiz({ ...data, questions: sorted });
      } else {
        console.error("Error loading quiz:", error);
      }
      setLoading(false);
    }
    fetchQuiz();
  }, [quizId]);

  // Sync active question list when mode changes (review uses questions set directly in startReviewRound)
  useEffect(() => {
    if (!quiz || mode === "review") return;
    setQuestions(quiz.questions ?? []);
  }, [mode, quiz]);

  const currentQuestion = questions[currentIndex] ?? null;

  // QuickFire timer — reset only when a new question is truly ready (not mid-advance)
  useEffect(() => {
    if (mode !== "quickfire" || !currentQuestion || sessionResult || advancing) return;
    setQuickFireTimeLeft(currentQuestion.time_limit ?? 20);
    setTimerPaused(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentQuestion?.id, sessionResult]); // intentionally exclude `advancing`

  // QuickFire timer — tick (pause while advancing so clock doesn't run on next card)
  useEffect(() => {
    if (mode !== "quickfire" || !currentQuestion || sessionResult || advancing || timerPaused || quickFireTimeLeft === null || quickFireTimeLeft <= 0) return;
    const t = window.setTimeout(() => setQuickFireTimeLeft((n) => n === null ? null : n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [advancing, currentQuestion, mode, quickFireTimeLeft, sessionResult, timerPaused]);

  // QuickFire timer — expired → auto-wrong
  useEffect(() => {
    if (!shouldExpireQuickFireQuestion({
      mode,
      hasQuestion: !!currentQuestion,
      sessionComplete: !!sessionResult,
      advancing,
      timerPaused,
      timeLeft: quickFireTimeLeft,
    })) return;
    void recordAnswer(false, null);
  }, [advancing, currentQuestion, mode, quickFireTimeLeft, sessionResult, timerPaused]);

  const persistProgress = async (result: SessionResult, studyMode: StudyMode = mode) => {
    if (!user || !quiz) {
      setSaveMessage("Sign in to save progress across devices.");
      return;
    }
    if (studyMode === "review") {
      setSaveMessage(saved ? "Review round complete. Your original session remains saved." : "Review round complete. Your original session has not been saved yet.");
      return;
    }
    if (studyMode !== "flashcard" && studyMode !== "quickfire") {
      setSaveMessage("Choose a study mode before saving progress.");
      return;
    }
    if (saveInFlight.current || saved) return;
    saveInFlight.current = true;
    setSaving(true);
    setSaveMessage("");
    try {
      const { data: completion, error: completionError } = await supabase.rpc("complete_study_session_atomic", {
        p_quiz_id: quiz.id,
        p_attempt_id: attemptIdRef.current,
        p_answers: submittedAnswersRef.current,
        p_study_mode: studyMode,
        p_duration_secs: null,
      });
      if (completionError || !completion || typeof completion.xp_earned !== "number" || typeof completion.total_xp !== "number") {
        throw new Error("Could not confirm progress was saved.");
      }
      setTotalXp(completion.total_xp);
      setSaved(true);
      setSaveMessage(`Progress saved · +${completion.xp_earned} XP`);
      try { sessionStorage.removeItem("qw_pending_study"); } catch { /* optional storage */ }
      try {
        const granted = await checkAndGrantAchievements({ userId: user.id, supabase,
          sessionResult: { correct: result.correct, total: result.total, mode: studyMode } });
        setNewAchievements(granted);
      } catch { /* progress is saved even if achievement lookup fails */ }
    } catch {
      setSaveMessage("Could not save progress. Retry to save this same attempt.");
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!quiz || recoveryLoaded.current) return;
    recoveryLoaded.current = true;
    try {
      const pending = JSON.parse(sessionStorage.getItem("qw_pending_study") || "null");
      if (pending?.quizId !== quiz.id || !UUID_RE.test(pending.attemptId) ||
          !["flashcard", "quickfire"].includes(pending.mode) || !Array.isArray(pending.answers) ||
          !pending.result || !Array.isArray(pending.result.wrongQuestions)) return;
      attemptIdRef.current = pending.attemptId;
      submittedAnswersRef.current = pending.answers;
      completedAttemptRef.current = { result: pending.result, mode: pending.mode };
      setMode(pending.mode);
      setSessionResult(pending.result);
      setSaveMessage("Your completed session is ready to save. Choose Retry save.");
    } catch { /* no recoverable session */ }
  }, [quiz]);

  function signInToSave() {
    try {
      sessionStorage.setItem("qw_pending_study", JSON.stringify({ quizId: quiz!.id,
        attemptId: attemptIdRef.current, answers: submittedAnswersRef.current, mode: completedAttemptRef.current?.mode ?? mode, result: completedAttemptRef.current?.result ?? sessionResult }));
      router.push(`/login?next=${encodeURIComponent(`/study/${quizId}`)}`);
    } catch { setSaveMessage("Could not preserve this session. Allow browser storage, then try signing in again."); }
  }

  const finishSession = async (correct: number, total: number, wrong: StudyQuestion[]) => {
    const result: SessionResult = { correct, total, wrongQuestions: wrong };
    if (mode === "flashcard" || mode === "quickfire") completedAttemptRef.current = { result, mode };
    setSessionResult(result);
    await persistProgress(result);
  };

  const ADVANCE_DELAY = 1800;

  const advanceToNext = async (nextCorrect: number, nextTotal: number, nextWrong: StudyQuestion[]) => {
    if (currentIndex < questions.length - 1) {
      setAdvancing(true);
      setTimerPaused(true); // freeze QuickFire clock during feedback window
      window.setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        setCardState("front");
        setLastAnswerCorrect(null);
        setAdvancing(false);
        // timerPaused clears via the reset effect once currentQuestion?.id changes
      }, ADVANCE_DELAY);
      return;
    }
    setAdvancing(true);
    setTimerPaused(true);
    window.setTimeout(() => void finishSession(nextCorrect, nextTotal, nextWrong), ADVANCE_DELAY);
  };

  const recordAnswer = async (correct: boolean, answerId: string | null) => {
    if (advancing) return;
    if (mode !== "review" && currentQuestion) {
      submittedAnswersRef.current.push({ question_id: currentQuestion.id, answer_id: answerId });
    }
    setLastAnswerCorrect(correct);
    const nextCorrect = correctCount + (correct ? 1 : 0);
    const nextTotal   = answeredCount + 1;
    const nextWrong   = correct ? wrongQuestions : [...wrongQuestions, currentQuestion!];
    setCorrectCount(nextCorrect);
    setAnsweredCount(nextTotal);
    setWrongQuestions(nextWrong);
    if (mode === "quickfire") {
      setTimerPaused(true);
      setAdvancing(true);
      setPendingQuickFireAdvance({ correct: nextCorrect, total: nextTotal, wrong: nextWrong });
      return;
    }
    await advanceToNext(nextCorrect, nextTotal, nextWrong);
  };

  const continueQuickFire = async () => {
    if (!pendingQuickFireAdvance) return;
    const pending = pendingQuickFireAdvance;
    setPendingQuickFireAdvance(null);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((index) => index + 1);
      setCardState("front");
      setLastAnswerCorrect(null);
      setAdvancing(false);
      return;
    }
    await finishSession(pending.correct, pending.total, pending.wrong);
  };

  const startReviewRound = () => {
    const reviewQs = wrongQuestions; // capture before any state clears
    setQuestions(reviewQs);
    setCurrentIndex(0);
    setCardState("front");
    setCorrectCount(0);
    setAnsweredCount(0);
    setWrongQuestions([]);
    setSessionResult(null);
    setSaveMessage("");
    setPendingQuickFireAdvance(null);
    setAdvancing(false);
    setLastAnswerCorrect(null);
    setMode("review");
  };

  const resetSession = () => {
    if (saveInFlight.current) return;
    try { sessionStorage.removeItem("qw_pending_study"); } catch { /* optional storage */ }
    setSaved(false);
    completedAttemptRef.current = null;
    submittedAnswersRef.current = [];
    setCurrentIndex(0);
    setCardState("front");
    setCorrectCount(0);
    setAnsweredCount(0);
    setWrongQuestions([]);
    setSessionResult(null);
    setSaveMessage("");
    setPendingQuickFireAdvance(null);
    setAdvancing(false);
    setQuickFireTimeLeft(null);
    setTimerPaused(false);
    setLastAnswerCorrect(null);
    setTotalXp(undefined);
    setNewAchievements([]);
    setMode("choose");
  };

  if (loading) return <StudyLoadingState message="Loading quiz..." />;
  if (!quiz)   return (
    <div className="container" style={{ textAlign: "center", padding: "4rem 1rem" }}>
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔍</div>
      <h2 className="font-display" style={{ marginBottom: "0.5rem" }}>Quiz not found</h2>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>This quiz may have been removed or made private.</p>
      <a href="/explore" className="btn btn-primary">Browse Quizzes</a>
    </div>
  );

  if (sessionResult) {
    return (
      <StudyResultPanel
        result={sessionResult}
        mode={mode}
        saving={saving}
        saved={saved}
        onRetrySave={user && !saved ? () => void persistProgress(completedAttemptRef.current?.result ?? sessionResult, completedAttemptRef.current?.mode ?? mode) : undefined}
        onSignIn={!user && !saved ? signInToSave : undefined}
        saveMessage={saveMessage}
        totalXp={totalXp}
        newAchievements={newAchievements}
        onReset={resetSession}
        onReview={!saving && sessionResult.wrongQuestions.length > 0 ? startReviewRound : undefined}
        onBack={() => router.push("/study")}
      />
    );
  }

  if (mode === "choose") {
    return (
      <StudyModeChooser
        title={quiz.title}
        questionCount={quiz.questions?.length ?? 0}
        onBack={() => router.push("/study")}
        onChoose={(chosen) => {
          attemptIdRef.current = crypto.randomUUID();
          submittedAnswersRef.current = [];
          setQuestions(quiz.questions ?? []);
          setMode(chosen);
        }}
      />
    );
  }

  if (!currentQuestion) {
    return <StudyLoadingState message="No questions available." />;
  }

  if (mode === "quickfire") {
    return (
      <QuickFirePanel
        question={currentQuestion}
        currentIndex={currentIndex}
        totalQuestions={questions.length}
        correctCount={correctCount}
        answeredCount={answeredCount}
        timeLeft={quickFireTimeLeft ?? currentQuestion.time_limit ?? 20}
        advancing={advancing}
        lastAnswerCorrect={lastAnswerCorrect}
        onExit={resetSession}
        onAnswer={(correct, answerId) => void recordAnswer(correct, answerId)}
        onContinue={() => void continueQuickFire()}
      />
    );
  }

  if (mode === "review") {
    return (
      <StudyReviewPanel
        question={currentQuestion}
        currentIndex={currentIndex}
        totalQuestions={questions.length}
        correctCount={correctCount}
        advancing={advancing}
        lastAnswerCorrect={lastAnswerCorrect}
        onExit={resetSession}
        onAnswer={(correct, answerId) => void recordAnswer(correct, answerId)}
      />
    );
  }

  // flashcard
  return (
    <FlashcardPanel
      question={currentQuestion}
      cardState={cardState}
      currentIndex={currentIndex}
      totalQuestions={questions.length}
      correctCount={correctCount}
      answeredCount={answeredCount}
      advancing={advancing}
      lastAnswerCorrect={lastAnswerCorrect}
      onExit={() => setMode("choose")}
      onFlip={() => setCardState((s) => (s === "front" ? "back" : "front"))}
      onAnswer={(correct, answerId) => void recordAnswer(correct, answerId)}
    />
  );
}

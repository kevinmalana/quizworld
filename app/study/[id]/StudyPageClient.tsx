"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { checkAndGrantAchievements } from "@/lib/achievements";

import type { CardState, SessionResult, StudyMode, StudyQuestion, StudyQuiz } from "@/lib/study/types";
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
  const [saving, setSaving]           = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [totalXp, setTotalXp]         = useState<number | undefined>(undefined);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [quickFireTimeLeft, setQuickFireTimeLeft] = useState(0);
  const [advancing, setAdvancing]     = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [timerPaused, setTimerPaused] = useState(false);

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
    if (mode !== "quickfire" || !currentQuestion || sessionResult || advancing || timerPaused || quickFireTimeLeft <= 0) return;
    const t = window.setTimeout(() => setQuickFireTimeLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [advancing, currentQuestion, mode, quickFireTimeLeft, sessionResult, timerPaused]);

  // QuickFire timer — expired → auto-wrong
  useEffect(() => {
    if (mode !== "quickfire" || !currentQuestion || sessionResult || advancing || timerPaused || quickFireTimeLeft > 0) return;
    void recordAnswer(false);
  }, [advancing, currentQuestion, mode, quickFireTimeLeft, sessionResult, timerPaused]);

  const persistProgress = async (result: SessionResult) => {
    if (!user || !quiz) {
      setSaveMessage("Sign in to save progress across devices.");
      return;
    }
    setSaving(true);
    const mastery        = Math.round((result.correct / Math.max(result.total, 1)) * 100);
    const now            = new Date().toISOString();
    const xpPerCorrect   = mode === "quickfire" ? 45 : 25;
    const completionBonus = result.correct === result.total && result.total > 0 ? 50 : 0;
    const perfectBonus   = result.correct === result.total && result.total > 0 ? 100 : 0;
    const sessionXp      = result.correct * xpPerCorrect + completionBonus + perfectBonus;
    const studyMode      = mode === "review" ? "flashcard" : mode;

    // 1. Upsert study_progress (mastery per quiz)
    const { error: progressError } = await supabase.from("study_progress").upsert(
      { user_id: user.id, quiz_id: quiz.id, questions_studied: result.total, correct: result.correct, mastery, last_studied: now },
      { onConflict: "user_id,quiz_id" }
    );
    if (progressError) console.error("Error saving study progress:", progressError);

    // 2. Insert study session row (XP history + sparkline source)
    const { error: sessionError } = await supabase.from("study_sessions").insert({
      user_id: user.id,
      quiz_id: quiz.id,
      xp_earned: sessionXp,
      correct: result.correct,
      total: result.total,
      study_mode: studyMode,
    });
    if (sessionError) console.error("Error saving study session:", sessionError);

    // 3. Increment profile XP
    if (sessionXp > 0) {
      const { error: xpError } = await supabase.rpc("increment_xp", { user_uuid: user.id, xp_amount: sessionXp });
      if (xpError) console.error("Error incrementing XP:", xpError);
      else {
        // Fetch updated total_xp to show live level progress on result screen
        const { data: profile } = await supabase.from("profiles").select("total_xp").eq("id", user.id).single();
        if (profile?.total_xp !== undefined) setTotalXp(profile.total_xp);
      }
    }

    // 4. Update daily streak
    const { error: streakError } = await supabase.rpc("update_study_streak", { user_uuid: user.id });
    if (streakError) console.error("Error updating streak:", streakError);

    const saved = !progressError && !sessionError;
    setSaveMessage(saved ? `Progress saved · +${sessionXp} XP` : "Could not save progress this time.");
    setSaving(false);

    // Check + grant achievements after save
    if (saved) {
      const granted = await checkAndGrantAchievements({
        userId: user.id,
        supabase,
        sessionResult: { correct: result.correct, total: result.total, mode },
      });
      if (granted.length > 0) setNewAchievements(granted);
    }
  };

  const finishSession = async (correct: number, total: number, wrong: StudyQuestion[]) => {
    const result: SessionResult = { correct, total, wrongQuestions: wrong };
    setSessionResult(result);
    await persistProgress(result);
  };

  const ADVANCE_DELAY = mode === "quickfire" ? 1200 : 1800;

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
    await finishSession(nextCorrect, nextTotal, nextWrong);
  };

  const recordAnswer = async (correct: boolean) => {
    if (advancing) return;
    setLastAnswerCorrect(correct);
    const nextCorrect = correctCount + (correct ? 1 : 0);
    const nextTotal   = answeredCount + 1;
    const nextWrong   = correct ? wrongQuestions : [...wrongQuestions, currentQuestion!];
    setCorrectCount(nextCorrect);
    setAnsweredCount(nextTotal);
    setWrongQuestions(nextWrong);
    await advanceToNext(nextCorrect, nextTotal, nextWrong);
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
    setAdvancing(false);
    setLastAnswerCorrect(null);
    setMode("review");
  };

  const resetSession = () => {
    setCurrentIndex(0);
    setCardState("front");
    setCorrectCount(0);
    setAnsweredCount(0);
    setWrongQuestions([]);
    setSessionResult(null);
    setSaveMessage("");
    setAdvancing(false);
    setQuickFireTimeLeft(0);
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
        saveMessage={saveMessage}
        totalXp={totalXp}
        newAchievements={newAchievements}
        onReset={resetSession}
        onReview={sessionResult.wrongQuestions.length > 0 ? startReviewRound : undefined}
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
        timeLeft={quickFireTimeLeft}
        advancing={advancing}
        lastAnswerCorrect={lastAnswerCorrect}
        onExit={() => setMode("choose")}
        onAnswer={(correct) => void recordAnswer(correct)}
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
        onAnswer={(correct) => void recordAnswer(correct)}
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
      onAnswer={(correct) => void recordAnswer(correct)}
    />
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";

import type { CardState, SessionResult, StudyMode, StudyQuestion, StudyQuiz } from "@/lib/study/types";
import {
  FlashcardPanel,
  QuickFirePanel,
  StudyLoadingState,
  StudyModeChooser,
  StudyResultPanel,
  StudyReviewPanel,
} from "@/components/study/study-session-panels";

export default function StudyPage() {
  const params   = useParams();
  const router   = useRouter();
  const { user } = useAuth();
  const quizId   = params.id as string;

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
  const [quickFireTimeLeft, setQuickFireTimeLeft] = useState(0);
  const [advancing, setAdvancing]     = useState(false);
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

  // Sync active question list when mode changes
  useEffect(() => {
    if (!quiz) return;
    if (mode === "review") {
      // Review round uses the wrong answers from the completed session
      setQuestions(wrongQuestions);
    } else {
      setQuestions(quiz.questions ?? []);
    }
  }, [mode, quiz]);

  const currentQuestion = questions[currentIndex] ?? null;

  // QuickFire timer — reset on question change
  useEffect(() => {
    if (mode !== "quickfire" || !currentQuestion || sessionResult) return;
    setQuickFireTimeLeft(currentQuestion.time_limit ?? 20);
  }, [mode, currentQuestion?.id, sessionResult]);

  // QuickFire timer — tick
  useEffect(() => {
    if (mode !== "quickfire" || !currentQuestion || sessionResult || advancing || quickFireTimeLeft <= 0) return;
    const t = window.setTimeout(() => setQuickFireTimeLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [advancing, currentQuestion, mode, quickFireTimeLeft, sessionResult]);

  // QuickFire timer — expired → auto-wrong
  useEffect(() => {
    if (mode !== "quickfire" || !currentQuestion || sessionResult || advancing || quickFireTimeLeft > 0) return;
    void recordAnswer(false);
  }, [advancing, currentQuestion, mode, quickFireTimeLeft, sessionResult]);

  const persistProgress = async (result: SessionResult) => {
    if (!user || !quiz) {
      setSaveMessage("Sign in to save progress across devices.");
      return;
    }
    setSaving(true);
    const mastery  = Math.round((result.correct / Math.max(result.total, 1)) * 100);
    const now      = new Date().toISOString();
    const xpPerCorrect   = mode === "quickfire" ? 45 : 25;
    const completionBonus = result.correct === result.total && result.total > 0 ? 50 : 0;
    const perfectBonus   = result.correct === result.total && result.total > 0 ? 100 : 0;
    const sessionXp = result.correct * xpPerCorrect + completionBonus + perfectBonus;

    const { error } = await supabase.from("study_progress").upsert(
      { user_id: user.id, quiz_id: quiz.id, questions_studied: result.total, correct: result.correct, mastery, last_studied: now },
      { onConflict: "user_id,quiz_id" }
    );
    setSaveMessage(error ? "Could not save progress this time." : `Progress saved · +${sessionXp} XP`);
    if (error) console.error("Error saving study progress:", error);
    setSaving(false);
  };

  const finishSession = async (correct: number, total: number, wrong: StudyQuestion[]) => {
    const result: SessionResult = { correct, total, wrongQuestions: wrong };
    setSessionResult(result);
    await persistProgress(result);
  };

  const advanceToNext = async (nextCorrect: number, nextTotal: number, nextWrong: StudyQuestion[]) => {
    if (currentIndex < questions.length - 1) {
      setAdvancing(true);
      window.setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        setCardState("front");
        setAdvancing(false);
        setLastAnswerCorrect(null);
      }, 600);
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
    setQuestions(wrongQuestions);
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
    setLastAnswerCorrect(null);
    setMode("choose");
  };

  if (loading) return <StudyLoadingState message="Loading quiz..." />;
  if (!quiz)   return <StudyLoadingState message="Quiz not found" />;

  if (sessionResult) {
    return (
      <StudyResultPanel
        result={sessionResult}
        mode={mode}
        saving={saving}
        saveMessage={saveMessage}
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

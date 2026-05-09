"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";

import type { CardState, SessionResult, StudyMode, StudyQuiz } from "@/lib/study/types";
import {
  FlashcardPanel,
  QuickFirePanel,
  StudyLoadingState,
  StudyModeChooser,
  StudyResultPanel,
} from "@/components/study/study-session-panels";

export default function StudyPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const quizId = params.id as string;

  const [quiz, setQuiz] = useState<StudyQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<StudyMode>("choose");
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
      } else {
        console.error("Error loading quiz:", error);
      }
      setLoading(false);
    }

    fetchQuiz();
  }, [quizId]);

  const currentQuestion = quiz?.questions?.[currentIndex] ?? null;

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

    const { error: progressError } = await supabase.from("study_progress").upsert(
      {
        user_id: user.id,
        quiz_id: quiz.id,
        questions_studied: result.total,
        correct: result.correct,
        mastery,
        last_studied: now,
      },
      { onConflict: "user_id,quiz_id" }
    );

    if (progressError) {
      console.error("Error saving study progress:", progressError);
      setSaveMessage("Could not save progress this time.");
    } else {
      setSaveMessage("Progress saved.");
    }
    setSaving(false);
  };

  const finishSession = async (result: SessionResult) => {
    setSessionResult(result);
    await persistProgress(result);
  };

  const advanceToNextQuestion = async (nextCorrect: number, nextTotal: number) => {
    if (currentIndex < (quiz?.questions?.length || 0) - 1) {
      setAdvancing(true);
      window.setTimeout(() => {
        setCurrentIndex((index) => index + 1);
        setCardState("front");
        setAdvancing(false);
      }, 350);
      return;
    }

    await finishSession({ correct: nextCorrect, total: nextTotal });
  };

  const recordAnswer = async (correct: boolean) => {
    if (advancing) return;

    setLastAnswerCorrect(correct);
    const nextCorrect = correctCount + (correct ? 1 : 0);
    const nextTotal = answeredCount + 1;
    setCorrectCount(nextCorrect);
    setAnsweredCount(nextTotal);
    await advanceToNextQuestion(nextCorrect, nextTotal);
  };

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
    setLastAnswerCorrect(null);
  };

  if (loading) {
    return <StudyLoadingState message="Loading quiz..." />;
  }

  if (!quiz) {
    return <StudyLoadingState message="Quiz not found" />;
  }

  if (sessionResult) {
    return (
      <StudyResultPanel
        result={sessionResult}
        mode={mode}
        saving={saving}
        saveMessage={saveMessage}
        onReset={resetSession}
        onBack={() => router.push("/study")}
      />
    );
  }

  if (mode === "choose") {
    return (
      <StudyModeChooser
        title={quiz.title}
        questionCount={quiz.questions?.length || 0}
        onBack={() => router.push("/study")}
        onChoose={setMode}
      />
    );
  }

  if (mode === "quickfire" && currentQuestion) {
    if (!currentQuestion) {
    return <StudyLoadingState message="Add a question to get started" />;
  }

  return (
    <FlashcardPanel
      question={currentQuestion}
      cardState={cardState}
      currentIndex={currentIndex}
      totalQuestions={quiz.questions?.length || 0}
      correctCount={correctCount}
      answeredCount={answeredCount}
      advancing={advancing}
      lastAnswerCorrect={lastAnswerCorrect}
      onExit={() => setMode("choose")}
      onFlip={() => setCardState((state) => (state === "front" ? "back" : "front"))}
      onAnswer={(correct) => void recordAnswer(correct)}
    />
  );
};

}
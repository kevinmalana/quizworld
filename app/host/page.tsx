"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { HostIcon } from "@/components/shared/host-icon";
import { createPhoenixSession } from "@/lib/game-engine/client";
import {
  isPhoenixGameEngine,
  legacySupabaseGameEngine,
  liveGameEngineMisconfigured,
} from "@/lib/game-engine/config";
import { writeHostSession } from "@/lib/host-session";

function generatePin(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pin = "";
  for (let i = 0; i < 6; i++) pin += chars[Math.floor(Math.random() * chars.length)];
  return pin;
}

function toPhoenixQuestions(quiz: any) {
  const questions = [...(quiz?.questions ?? [])].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );

  return questions.map((question: any) => ({
    id: question.id,
    text: question.text,
    image_url: question.image_url || null,
    video_url: question.video_url || null,
    time_limit: question.time_limit ?? 20,
    points: question.points ?? 1000,
    order_index: question.order_index ?? 0,
    answers: (question.answers ?? []).map((answer: any) => ({
      id: answer.id,
      text: answer.text,
      image_url: answer.image_url || null,
      is_correct: answer.is_correct ?? false,
    })),
  }));
}

function questionCount(quiz: any) {
  if (Array.isArray(quiz?.questions)) return quiz.questions.length;
  return quiz?.questions?.[0]?.count || 0;
}

function HostPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedQuiz = searchParams.get("quiz");
  const { user, loading: authLoading } = useAuth();

  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setQuizzes([]);
      setSelectedQuiz(null);
      return;
    }

    let ignore = false;
    const userId = user.id;

    async function loadQuizzes() {
      const { data, error: queryError } = await supabase
        .from("quizzes")
        .select("*, questions(*, answers(*))")
        .or(`is_public.eq.true,creator_id.eq.${userId}`)
        .is("archived_at", null)
        .limit(50);

      if (ignore) return;

      if (queryError) {
        console.error("Error loading host quizzes:", queryError);
        setError("Could not load quizzes right now.");
        return;
      }

      const loadedQuizzes = data ?? [];
      setQuizzes(loadedQuizzes);
      if (preSelectedQuiz) {
        const quiz = loadedQuizzes.find((row) => row.id === preSelectedQuiz) ?? null;
        setSelectedQuiz(quiz);
      } else {
        setSelectedQuiz((current: any) => current ?? loadedQuizzes[0] ?? null);
      }
    }

    loadQuizzes();

    return () => { ignore = true; };
  }, [preSelectedQuiz, user?.id]);

  const handleLaunch = async () => {
    if (!user) {
      sessionStorage.setItem("qw_post_login_redirect", "/host");
      router.push("/login");
      return;
    }

    if (!selectedQuiz) {
      setError("Select a quiz first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (isPhoenixGameEngine) {
        const {
          data: { session: authSession },
        } = await supabase.auth.getSession();

        if (!authSession?.access_token) {
          throw new Error("Sign in again before hosting a game.");
        }

        const response = await createPhoenixSession({
          quiz_id: selectedQuiz.id,
          game_mode: "classic",
          questions: toPhoenixQuestions(selectedQuiz),
        }, authSession.access_token);

        if (!response?.host_token || !response?.session?.pin) {
          throw new Error("Host session token missing.");
        }

        writeHostSession(response.session.pin, {
          hostId: user.id,
          hostToken: response.host_token,
        });
        setLoading(false);
        router.push(`/game/${response.session.pin}`);
        return;
      } else {
        const newPin = generatePin();
        const { error: sessionError } = await supabase.from("game_sessions").insert({
          pin: newPin,
          quiz_id: selectedQuiz.id,
          host_id: user.id,
          status: "waiting",
          current_question_index: -1,
          game_mode: "classic",
        });

        if (sessionError) throw sessionError;

        setLoading(false);
        router.push(`/game/${newPin}`);
        return;
      }
    } catch (sessionError) {
      console.error("Session create error:", sessionError);
      setError("Failed to create game. Try again.");
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="container report-status">Loading...</div>;
  }

  if (liveGameEngineMisconfigured) {
    return (
      <div className="container game-status-panel">
        <div className="card game-status-card">
          <div className="game-status-icon">⚙️</div>
          <h1 className="font-display game-status-title">Live Games Unavailable</h1>
          <p className="game-status-text">The live game service isn't reachable right now. Please try again shortly or contact support.</p>
        </div>
      </div>
    );
  }

  if (legacySupabaseGameEngine) {
    return (
      <div className="container game-status-panel">
        <div className="card game-status-card">
          <div className="game-status-icon">🛑</div>
          <h1 className="font-display game-status-title">Live Games Unavailable</h1>
          <p className="game-status-text">Live multiplayer games are temporarily unavailable. Please check back shortly.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container join-shell">
        <div className="card join-card">
          <div className="join-icon">🔐</div>
          <h1 className="font-display join-title">Sign In To Host</h1>
          <p className="join-subtitle">Hosting is authenticated so only the real host can control the live game.</p>
          <button
            onClick={() => { sessionStorage.setItem("qw_post_login_redirect", "/host"); router.push("/login"); }}
            className="btn btn-primary btn-lg btn-full mb-sm"
          >Sign In</button>
          <Link href="/explore" className="btn btn-secondary btn-full">Browse Quizzes</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container host-shell">
      <h1 className="font-display host-title"><HostIcon size={28} /> Host a Game</h1>
      <p className="host-subtitle">Pick a quiz and launch the live lobby.</p>

      <div className="host-section">
        <h3 className="host-section-title">Select a Quiz</h3>
        <div className="host-quiz-grid">
          {quizzes.map((quiz) => (
            <button
              key={quiz.id}
              onClick={() => setSelectedQuiz(quiz)}
              className={selectedQuiz?.id === quiz.id ? "host-quiz-option is-selected" : "host-quiz-option"}
            >
              <span className="host-quiz-emoji">{quiz.emoji || "📝"}</span>
              <div>
                <div className="host-quiz-title">{quiz.title}</div>
                <div className="host-quiz-meta">{questionCount(quiz)} questions</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="host-section">
        <h3 className="host-section-title">Game Mode</h3>
        <div className="host-mode-card is-selected">
          <div className="host-mode-title">🏆 Classic</div>
          <div className="host-mode-desc">Everyone answers simultaneously, points awarded for speed and accuracy. A winner is crowned at the end.</div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <button onClick={handleLaunch} disabled={loading || !selectedQuiz} className="btn btn-primary btn-lg host-launch-btn">
        {loading ? (selectedQuiz?.questions?.some((q: any) => q.image_url) ? "Creating... (images loading)" : "Creating...") : "Launch Game 🚀"}
      </button>
      {loading && selectedQuiz?.questions?.some((q: any) => q.image_url) && (
        <p className="host-launch-hint">Quizzes with images may take a few extra seconds to set up.</p>
      )}
    </div>
  );
}

export default function HostPage() {
  return (
    <Suspense fallback={<div className="container report-status">Loading...</div>}>
      <HostPageContent />
    </Suspense>
  );
}

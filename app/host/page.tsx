"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { createPhoenixSession } from "@/lib/game-engine/client";
import {
  isPhoenixGameEngine,
  legacySupabaseGameEngine,
  liveGameEngineMisconfigured,
} from "@/lib/game-engine/config";
import { writeHostSession } from "@/lib/host-session";
import { filterHostQuizzes, getHostQuizQuestionCount } from "@/lib/host-quiz-search";

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
    time_limit: question.time_limit ?? 20,
    points: question.points ?? 1000,
    order_index: question.order_index ?? 0,
    answers: (question.answers ?? []).map((answer: any) => ({
      id: answer.id,
      text: answer.text,
      is_correct: answer.is_correct ?? false,
    })),
  }));
}

function questionCount(quiz: any) {
  if (Array.isArray(quiz?.questions)) return getHostQuizQuestionCount(quiz);
  return quiz?.questions?.[0]?.count || 0;
}

function HostPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedQuiz = searchParams.get("quiz");
  const { user, loading: authLoading } = useAuth();

  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [quizSearch, setQuizSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const filteredQuizzes = useMemo(() => filterHostQuizzes(quizzes, quizSearch), [quizzes, quizSearch]);

  useEffect(() => {
    if (!user) {
      // Wait for auth to resolve before clearing state
      if (!authLoading) {
        setQuizzes([]);
        setSelectedQuiz(null);
      }
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
        .order("created_at", { ascending: false })
        .limit(500);

      if (ignore) return;

      if (queryError) {
        console.error("Error loading host quizzes:", queryError);
        setError("Could not load quizzes right now.");
        return;
      }

      setQuizzes(data ?? []);
      if (preSelectedQuiz) {
        const quiz = data?.find((row) => row.id === preSelectedQuiz) ?? null;
        setSelectedQuiz(quiz);
      }
    }

    loadQuizzes();

    return () => {
      ignore = true;
    };
  }, [preSelectedQuiz, user?.id, authLoading]);

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

        if (sessionError) {
          throw sessionError;
        }

        setLoading(false);
        router.push(`/game/${newPin}`);
        return;
      }
    } catch (sessionError) {
      console.error("Session create error:", sessionError);
      setError("Failed to create game. Try again.");
      setLoading(false);
      return;
    }

  };

  if (authLoading) {
    return (
      <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>
        Loading...
      </div>
    );
  }

  if (liveGameEngineMisconfigured) {
    return (
      <div className="container" style={{ paddingTop: "4rem", paddingBottom: "5rem", maxWidth: 520 }}>
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚙️</div>
          <h1 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.75rem" }}>
            Live Game Service Not Configured
          </h1>
          <p style={{ color: "var(--muted)" }}>
            `NEXT_PUBLIC_GAME_ENGINE` is set to Phoenix, but `NEXT_PUBLIC_GAME_SERVICE_URL` is missing.
          </p>
        </div>
      </div>
    );
  }

  if (legacySupabaseGameEngine) {
    return (
      <div className="container" style={{ paddingTop: "4rem", paddingBottom: "5rem", maxWidth: 520 }}>
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🛑</div>
          <h1 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.75rem" }}>
            Legacy Supabase Live Games Disabled
          </h1>
          <p style={{ color: "var(--muted)" }}>
            Production live sessions now require the Phoenix realtime service.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container" style={{ paddingTop: "4rem", paddingBottom: "5rem", maxWidth: 480 }}>
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔐</div>
          <h1 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.75rem" }}>
            Sign In To Host
          </h1>
          <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
            Hosting is authenticated so only the real host can control the live game.
          </p>
          <button
            onClick={() => {
              sessionStorage.setItem("qw_post_login_redirect", "/host");
              router.push("/login");
            }}
            className="btn btn-primary btn-lg"
            style={{ width: "100%", marginBottom: "0.75rem" }}
          >
            Sign In
          </button>
          <Link href="/explore" className="btn btn-secondary" style={{ width: "100%" }}>
            Browse Quizzes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: "4rem", paddingBottom: "5rem" }}>
      <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>
        🎮 Host a Game
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
        Pick a quiz and launch the live lobby.
      </p>

      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Select a Quiz</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              {filteredQuizzes.length === quizzes.length
                ? `${quizzes.length} quizzes available`
                : `${filteredQuizzes.length} of ${quizzes.length} quizzes match`}
            </p>
          </div>
          <input
            type="search"
            value={quizSearch}
            onChange={(event) => setQuizSearch(event.target.value)}
            placeholder="Search by title, category, emoji, or size"
            aria-label="Search quizzes to host"
            style={{
              minWidth: 280,
              flex: "1 1 320px",
              maxWidth: 460,
              padding: "0.85rem 1rem",
              borderRadius: "var(--radius-xl)",
              border: "2px solid var(--line)",
              background: "var(--surface)",
              color: "var(--ink)",
              fontWeight: 700,
            }}
          />
        </div>
        {filteredQuizzes.length === 0 ? (
          <div className="card" style={{ padding: "1.5rem", textAlign: "center", border: "1px solid var(--line)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔎</div>
            <div style={{ fontWeight: 800, marginBottom: "0.35rem" }}>No quizzes match that search</div>
            <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
              Try a different title, category, emoji, or question count.
            </p>
            <button type="button" className="btn btn-secondary" onClick={() => setQuizSearch("")}>
              Clear search
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {filteredQuizzes.map((quiz) => (
              <button
                key={quiz.id}
                onClick={() => setSelectedQuiz(quiz)}
                style={{
                  padding: "1rem 1.5rem",
                  borderRadius: "var(--radius-xl)",
                  border:
                    selectedQuiz?.id === quiz.id
                      ? "3px solid var(--accent)"
                      : "3px solid var(--line)",
                  background:
                    selectedQuiz?.id === quiz.id
                      ? "var(--accent-light)"
                      : "var(--surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <span style={{ fontSize: "1.5rem" }}>{quiz.emoji || "📝"}</span>
                <div>
                  <div style={{ fontWeight: 700 }}>{quiz.title}</div>
                  <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
                    {questionCount(quiz)} questions{quiz.category ? ` · ${quiz.category}` : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <h3 style={{ fontWeight: 700, marginBottom: "1rem" }}>Game Mode</h3>
        <div
          style={{
            padding: "1rem 1.1rem",
            borderRadius: "var(--radius-xl)",
            border: "2px solid var(--line)",
            background: "var(--surface)",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: "0.35rem" }}>🏆 Classic</div>
          <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
            Phoenix currently ships the authoritative classic mode. Additional modes should stay hidden until their rules are implemented server-side.
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            color: "var(--primary)",
            background: "var(--primary-light)",
            padding: "0.75rem",
            borderRadius: "var(--radius-lg)",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={handleLaunch}
        disabled={loading || !selectedQuiz}
        className="btn btn-primary btn-lg"
        style={{ width: "100%" }}
      >
        {loading ? "Creating..." : "Launch Game 🚀"}
      </button>
    </div>
  );
}

export default function HostPage() {
  return (
    <Suspense fallback={<div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>Loading...</div>}>
      <HostPageContent />
    </Suspense>
  );
}

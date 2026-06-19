// app/solo/[id]/page.tsx — client-side solo play
// No Phoenix, no game session, no WebSockets. Pure local state.
// Questions + answers fetched from Supabase at load time.

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

interface Answer {
  id: string;
  text: string;
  is_correct: boolean;
}

interface Question {
  id: string;
  text: string;
  answers: Answer[];
  time_limit?: number;
  points?: number;
}

interface Quiz {
  id: string;
  title: string;
  category: string;
  emoji?: string;
  slug?: string | null;
  questions: Question[];
}

type Phase = "loading" | "ready" | "playing" | "reveal" | "done";

export default function SoloPlayPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [phase, setPhase] = useState<Phase>("loading");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correctId, setCorrectId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [results, setResults] = useState<{ correct: number; total: number; points: number }[]>([]);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answeredRef = useRef(false);

  // Fetch quiz data
  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error: fetchErr } = await supabase
        .from("quizzes")
        .select("id, title, category, emoji, slug, questions(id, text, time_limit, points, answers(id, text, is_correct))")
        .eq("id", id)
        .single();

      if (fetchErr || !data) {
        setError("Quiz not found");
        setPhase("ready");
        return;
      }
      setQuiz(data as unknown as Quiz);
      setPhase("ready");
    })();
  }, [id]);

  const question = quiz?.questions[qIndex];

  // Timer
  const startTimer = useCallback((seconds: number) => {
    answeredRef.current = false;
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (!answeredRef.current) {
            answeredRef.current = true;
            setPicked(null as any); // trigger reveal
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Start playing
  const handleStart = () => {
    setPhase("playing");
    setQIndex(0);
    setScore(0);
    setResults([]);
    setPicked(null);
    startTimer(question?.time_limit || 20);
  };

  // Answer picked
  const handlePick = (answerId: string) => {
    if (!question || picked !== null) return;
    if (timerRef.current) clearInterval(timerRef.current);
    answeredRef.current = true;

    const correct = question.answers.find((a) => a.is_correct);
    setPicked(answerId);
    setCorrectId(correct?.id || null);

    const isCorrect = correct?.id === answerId;
    const pts = isCorrect ? (question.points || 1000) : 0;
    setScore((s) => s + pts);
    setResults((r) => [...r, { correct: isCorrect ? 1 : 0, total: 1, points: pts }]);

    setPhase("reveal");
  };

  // Time ran out
  useEffect(() => {
    if (phase === "playing" && timeLeft === 0 && picked === null && question) {
      const correct = question.answers.find((a) => a.is_correct);
      setCorrectId(correct?.id || null);
      setResults((r) => [...r, { correct: 0, total: 1, points: 0 }]);
      setPhase("reveal");
    }
  }, [timeLeft, phase, picked, question]);

  // Next question / finish
  const handleNext = () => {
    if (qIndex + 1 >= (quiz?.questions.length || 0)) {
      setPhase("done");
      // Increment play count
      if (quiz) supabase.rpc("increment_quiz_plays", { quiz_id: quiz.id }).then(() => {});
      return;
    }
    setPicked(null);
    setCorrectId(null);
    setQIndex((i) => i + 1);
    setPhase("playing");
    const nextQ = quiz?.questions[qIndex + 1];
    startTimer(nextQ?.time_limit || 20);
  };

  // Loading
  if (phase === "loading") {
    return (
      <div className="container" style={{ textAlign: "center", padding: "4rem 0" }}>
        <div className="spinner" />
        <p style={{ marginTop: "1rem", color: "var(--text-muted)" }}>Loading quiz...</p>
      </div>
    );
  }

  // Error / not found
  if (error) {
    return (
      <div className="container" style={{ textAlign: "center", padding: "4rem 0" }}>
        <p style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>Quiz not found</p>
        <button className="btn btn-secondary" onClick={() => router.push("/explore")}>
          ← Back to Explore
        </button>
      </div>
    );
  }

  if (!quiz || quiz.questions.length === 0) {
    return (
      <div className="container" style={{ textAlign: "center", padding: "4rem 0" }}>
        <p style={{ fontSize: "1.25rem" }}>This quiz has no questions yet.</p>
        <button className="btn btn-secondary" onClick={() => router.push("/explore")} style={{ marginTop: "1rem" }}>
          ← Back to Explore
        </button>
      </div>
    );
  }

  const totalCorrect = results.filter((r) => r.correct).length;
  const totalQ = quiz.questions.length;

  return (
    <div className="container" style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Ready screen */}
      {phase === "ready" && (
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{quiz.emoji || "🧠"}</div>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{quiz.title}</h1>
          <p className="text-muted">
            {quiz.category} · {totalQ} questions
          </p>
          <button className="btn btn-primary" onClick={handleStart} style={{ marginTop: "1.5rem", fontSize: "1.1rem", padding: "0.75rem 2rem" }}>
            ▶ Start Quiz
          </button>
          <br />
          <button className="btn btn-ghost" onClick={() => router.back()} style={{ marginTop: "0.75rem" }}>
            ← Back
          </button>
        </div>
      )}

      {/* Playing phase */}
      {phase === "playing" && question && (
        <>
          {/* Progress */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
            <span>Question {qIndex + 1} / {totalQ}</span>
            <span>Score: {score.toLocaleString()}</span>
          </div>
          <div className="progress-bar" style={{ height: 4, marginBottom: "1.5rem" }}>
            <div className="progress-bar-fill" style={{ width: `${((qIndex + 1) / totalQ) * 100}%` }} />
          </div>

          {/* Timer */}
          <div style={{ textAlign: "center", marginBottom: "1rem" }}>
            <span style={{
              fontSize: "1.5rem", fontWeight: 700,
              color: timeLeft <= 5 ? "var(--danger, #ef4444)" : "var(--text)",
              transition: "color 0.3s",
            }}>
              {timeLeft}s
            </span>
          </div>

          {/* Question */}
          <div className="card" style={{ marginBottom: "1rem", padding: "1.5rem" }}>
            <h2 style={{ fontSize: "1.2rem", lineHeight: 1.5 }}>{question.text}</h2>
          </div>

          {/* Answers */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {question.answers.map((a) => (
              <button
                key={a.id}
                className="btn btn-secondary"
                onClick={() => handlePick(a.id)}
                disabled={picked !== null || timeLeft === 0}
                style={{ textAlign: "left", padding: "0.875rem 1rem", fontSize: "1rem" }}
              >
                {a.text}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Reveal phase */}
      {phase === "reveal" && question && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
            <span>Question {qIndex + 1} / {totalQ}</span>
            <span>Score: {score.toLocaleString()}</span>
          </div>

          <div className="card" style={{ padding: "1.5rem", textAlign: "center", marginBottom: "1rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
              {picked === correctId ? "✅" : "❌"}
            </div>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>{question.text}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {question.answers.map((a) => {
                const isCorrect = a.id === correctId;
                const wasPicked = a.id === picked;
                return (
                  <div
                    key={a.id}
                    style={{
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.5rem",
                      background: isCorrect ? "var(--success-bg, #dcfce7)" : wasPicked && !isCorrect ? "var(--danger-bg, #fee2e2)" : "var(--surface)",
                      border: `1px solid ${isCorrect ? "var(--success, #22c55e)" : wasPicked && !isCorrect ? "var(--danger, #ef4444)" : "var(--line)"}`,
                      textAlign: "left",
                    }}
                  >
                    {a.text} {isCorrect && " ✓"}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <button className="btn btn-primary" onClick={handleNext} style={{ padding: "0.75rem 2rem" }}>
              {qIndex + 1 >= totalQ ? "🏆 See Results" : "Next →"}
            </button>
          </div>
        </>
      )}

      {/* Done screen */}
      {phase === "done" && (
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>
            {totalCorrect === totalQ ? "🎉" : totalCorrect > totalQ / 2 ? "👏" : "💪"}
          </div>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Quiz Complete!</h1>
          <div style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            {totalCorrect} / {totalQ}
          </div>
          <p className="text-muted" style={{ marginBottom: "0.5rem" }}>
            Score: {score.toLocaleString()} points
          </p>
          <p className="text-muted" style={{ marginBottom: "1.5rem" }}>
            Accuracy: {totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0}%
          </p>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={handleStart}>
              🔄 Play Again
            </button>
            <button className="btn btn-secondary" onClick={() => router.push(`/quiz/${quiz.slug || quiz.id}`)}>
              📋 Quiz Info
            </button>
            <button className="btn btn-secondary" onClick={() => router.push("/explore")}>
              🔍 More Quizzes
            </button>
          </div>
        </div>
      )}

      {/* Bottom padding */}
      <div style={{ height: "2rem" }} />
    </div>
  );
}
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";

type StudyProgressRow = {
  quiz_id: string;
  questions_studied: number;
  correct: number;
  mastery: number;
  last_studied: string;
};

export default function StudyListPage() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [progress, setProgress] = useState<StudyProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizError, setQuizError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      setLoading(true);
      setQuizError(null);

      const quizQuery = supabase
        .from("quizzes")
        .select("*, questions(*)")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      const { data: quizData, error: quizError } = user
        ? await quizQuery.or(`is_public.eq.true,creator_id.eq.${user.id}`)
        : await quizQuery.eq("is_public", true);

      if (ignore) return;

      if (quizError) {
        console.error("Error loading study quizzes:", quizError);
        setQuizError("Could not load study sets. Please try again.");
        setQuizzes([]);
      } else {
        setQuizzes(quizData ?? []);
      }

      if (!user) {
        if (!ignore) {
          setProgress([]);
          setLoading(false);
        }
        return;
      }

      const { data: progressData, error: progressError } = await supabase
        .from("study_progress")
        .select("quiz_id, questions_studied, correct, mastery, last_studied")
        .eq("user_id", user.id)
        .order("last_studied", { ascending: false });

      if (ignore) return;

      if (progressError) {
        console.error("Error loading study progress:", progressError);
        setProgress([]);
      } else {
        setProgress(progressData ?? []);
      }

      setLoading(false);
    }

    fetchData();

    return () => {
      ignore = true;
    };
  }, [user?.id]);

  const progressByQuizId = useMemo(
    () => new Map(progress.map((entry) => [entry.quiz_id, entry])),
    [progress]
  );
  const studiedQuizzes = quizzes.filter((quiz) => progressByQuizId.has(quiz.id));
  const availableQuizzes = quizzes.filter((quiz) => !progressByQuizId.has(quiz.id));
  const averageMastery = progress.length
    ? Math.round(progress.reduce((sum, entry) => sum + (entry.mastery ?? 0), 0) / progress.length)
    : 0;

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📡</div>
        <p style={{ color: "var(--muted)" }}>Loading study sets...</p>
      </div>
    );
  }

  if (quizError) {
    return (
      <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>
        <div
          className="card"
          style={{
            padding: "3rem 2rem",
            textAlign: "center",
            border: "2px dashed var(--line-strong)",
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
          <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)" }}>
            Could not load study sets
          </h3>
          <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>{quizError}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary"
            style={{ marginTop: "1.25rem" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "calc(100vh - 72px)", background: "var(--bg)", paddingBottom: "5rem" }}>
      <div className="container" style={{ paddingTop: "3rem" }}>
        <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>
          🧠 Study Hall
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
          Review public quizzes and track mastery over time.
        </p>

        {!user && (
          <div
            className="card"
            style={{
              padding: "1rem 1.25rem",
              marginBottom: "2rem",
              border: "1px solid var(--line)",
              background: "var(--accent-light)",
            }}
          >
            Sign in to save study progress across sessions.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", marginBottom: "3rem" }}>
          <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📚</div>
            <div style={{ fontWeight: 800, fontSize: "1.5rem" }}>{studiedQuizzes.length}</div>
            <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Studied</div>
          </div>
          <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎯</div>
            <div style={{ fontWeight: 800, fontSize: "1.5rem" }}>{averageMastery}%</div>
            <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Avg Mastery</div>
          </div>
          <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✨</div>
            <div style={{ fontWeight: 800, fontSize: "1.5rem" }}>{availableQuizzes.length}</div>
            <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Available</div>
          </div>
        </div>

        {studiedQuizzes.length > 0 && (
          <>
            <h2 style={{ fontWeight: 800, marginBottom: "1.5rem" }}>Continue Studying</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", marginBottom: "3rem" }}>
              {studiedQuizzes.map((quiz) => {
                const quizProgress = progressByQuizId.get(quiz.id);
                return (
                  <Link
                    key={quiz.id}
                    href={`/study/${quiz.id}`}
                    className="card card-hover"
                    style={{ padding: "1.5rem", display: "block", textDecoration: "none", border: "2px solid var(--line)" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${quiz.color}15`, display: "grid", placeItems: "center", fontSize: "1.5rem" }}>
                        {quiz.emoji || "📝"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: "var(--ink)" }}>{quiz.title}</div>
                        <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
                          {quizProgress?.mastery ?? 0}% mastery
                        </div>
                      </div>
                    </div>
                    <button className="btn btn-primary" style={{ width: "100%" }}>
                      Resume
                    </button>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        <h2 style={{ fontWeight: 800, marginBottom: "1.5rem" }}>Ready to Study</h2>
        {availableQuizzes.length === 0 ? (
          <div
            className="card"
            style={{
              padding: "3rem 2rem",
              textAlign: "center",
              border: "2px dashed var(--line-strong)",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>
              {studiedQuizzes.length === 0 ? "📝" : "🎉"}
            </div>
            {studiedQuizzes.length === 0 ? (
              <>
                <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)" }}>
                  No study sets available
                </h3>
                <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
                  Create a quiz or explore public quizzes to get started.
                </p>
                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1.5rem", flexWrap: "wrap" }}>
                  <Link href="/explore" className="btn btn-secondary">
                    Browse Public Quizzes
                  </Link>
                  <Link href="/create" className="btn btn-primary">
                    Create Quiz
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)" }}>
                  All caught up!
                </h3>
                <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
                  You've studied everything available. Create a quiz to add more.
                </p>
                <Link href="/create" className="btn btn-primary" style={{ marginTop: "1.25rem", display: "inline-flex" }}>
                  Create Quiz
                </Link>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", marginBottom: "3rem" }}>
            {availableQuizzes.map((quiz) => (
              <Link
                key={quiz.id}
                href={`/study/${quiz.id}`}
                className="card card-hover"
                style={{ padding: "1.5rem", display: "block", textDecoration: "none", border: "2px solid var(--line)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: `${quiz.color}15`, display: "grid", placeItems: "center", fontSize: "1.5rem" }}>
                    {quiz.emoji || "📝"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "var(--ink)" }}>{quiz.title}</div>
                    <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>{quiz.questions?.length || 0} questions</div>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ width: "100%" }}>
                  Study Now
                </button>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

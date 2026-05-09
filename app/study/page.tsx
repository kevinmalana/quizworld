"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { AvailableStudyQuizCard, ContinueStudyQuizCard } from "@/components/study/study-quiz-card";
import { StudyStatsDashboard, type StudyProgressRow, type StudySessionRow } from "@/components/study/study-dashboard";


type QuizRow = {
  id: string;
  title: string;
  emoji: string | null;
  color: string | null;
  category: string;
  questions?: { count: number }[];
};

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function StudyListPage() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [progress, setProgress] = useState<StudyProgressRow[]>([]);
  const [sessions, setSessions] = useState<StudySessionRow[]>([]);
  const [profile, setProfile] = useState<{ total_xp: number; study_streak: number; longest_streak: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [quizError, setQuizError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      setLoading(true);
      setQuizError(null);

      const quizQuery = supabase
        .from("quizzes")
        .select("id, title, emoji, color, category, questions(count)")
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
        if (!ignore) { setProgress([]); setSessions([]); setLoading(false); }
        return;
      }

      const [progressResult, profileResult] = await Promise.all([
        supabase
          .from("study_progress")
          .select("quiz_id, questions_studied, correct, mastery, last_studied")
          .eq("user_id", user.id)
          .order("last_studied", { ascending: false }),
        // Select the full profile row so Study Hall still loads if optional XP/streak
        // columns have not been deployed to the live Supabase schema yet.
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      if (ignore) return;

      if (progressResult.error) {
        console.error("Error loading study progress:", progressResult.error);
      } else {
        setProgress(progressResult.data ?? []);
      }

      setSessions([]);

      if (profileResult.data) {
        setProfile(profileResult.data as any);
      }

      setLoading(false);
    }

    fetchData();
    return () => { ignore = true; };
  }, [user?.id]);

  const progressByQuizId = useMemo(
    () => new Map(progress.map((entry) => [entry.quiz_id, entry])),
    [progress]
  );

  const studiedQuizzes = quizzes.filter((quiz) => progressByQuizId.has(quiz.id));
  const availableQuizzes = quizzes.filter((quiz) => !progressByQuizId.has(quiz.id));

  // Aggregate stats
  const totalCorrect = progress.reduce((s, p) => s + (p.correct ?? 0), 0);
  const totalStudied = progress.reduce((s, p) => s + (p.questions_studied ?? 0), 0);
  const avgMastery = progress.length
    ? Math.round(progress.reduce((s, p) => s + (p.mastery ?? 0), 0) / progress.length)
    : 0;
  const accuracyRate = totalStudied > 0 ? Math.round((totalCorrect / totalStudied) * 100) : 0;
  const totalXp = profile?.total_xp ?? 0;
  const streak = profile?.study_streak ?? 0;
  const longestStreak = profile?.longest_streak ?? 0;
  const totalSessionXp = sessions.reduce((s, sess) => s + (sess.xp_earned ?? 0), 0);

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
        <div className="card" style={{ padding: "3rem 2rem", textAlign: "center", border: "2px dashed var(--line-strong)", maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
          <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)" }}>
            Could not load study sets
          </h3>
          <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>{quizError}</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ marginTop: "1.25rem" }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "calc(100vh - 72px)", background: "var(--bg)", paddingBottom: "5rem" }}>
      <div className="container" style={{ paddingTop: "3rem" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>
              🧠 Study Hall
            </h1>
            <p style={{ color: "var(--muted)" }}>
              Master your knowledge with flashcards and quickfire practice.
            </p>
          </div>
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--accent-light)", padding: "0.5rem 1rem", borderRadius: 999 }}>
              <span style={{ fontSize: "1.1rem" }}>⭐</span>
              <span style={{ fontWeight: 800, color: "var(--accent)" }}>{totalXp.toLocaleString()} XP</span>
            </div>
          )}
        </div>

        {!user && (
          <div className="card" style={{ padding: "1rem 1.25rem", marginBottom: "2rem", border: "1px solid var(--line)", background: "var(--accent-light)" }}>
            Sign in to save study progress and earn XP across sessions.
          </div>
        )}

        {/* ── Stats dashboard (only when logged in) ── */}
        {user && (
          <StudyStatsDashboard
            totalXp={totalXp}
            streak={streak}
            longestStreak={longestStreak}
            studiedCount={studiedQuizzes.length}
            avgMastery={avgMastery}
            accuracyRate={accuracyRate}
            totalSessionXp={totalSessionXp}
            progress={progress}
            sessions={sessions}
          />
        )}

        {/* ── Continue Studying ── */}
        {studiedQuizzes.length > 0 && (
          <>
            <h2 style={{ fontWeight: 800, marginBottom: "1.25rem" }}>Continue Studying</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", marginBottom: "3rem" }}>
              {studiedQuizzes.map((quiz) => (
                <ContinueStudyQuizCard
                  key={quiz.id}
                  quiz={quiz}
                  progress={progressByQuizId.get(quiz.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Ready to Study ── */}
        <h2 style={{ fontWeight: 800, marginBottom: "1.25rem" }}>Ready to Study</h2>
        {availableQuizzes.length === 0 ? (
          <div className="card" style={{ padding: "3rem 2rem", textAlign: "center", border: "2px dashed var(--line-strong)" }}>
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
                  <Link href="/explore" className="btn btn-secondary">Browse Public Quizzes</Link>
                  <Link href="/create" className="btn btn-primary">Create Quiz</Link>
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
              <AvailableStudyQuizCard key={quiz.id} quiz={quiz} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

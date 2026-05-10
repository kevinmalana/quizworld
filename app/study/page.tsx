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

      const { data: quizData, error: qError } = user
        ? await quizQuery.or(`is_public.eq.true,creator_id.eq.${user.id}`)
        : await quizQuery.eq("is_public", true);

      if (ignore) return;

      if (qError) {
        console.error("Error loading study quizzes:", qError);
        setQuizError("Could not load study sets. Please try again.");
        setQuizzes([]);
        setLoading(false);
        return;
      }

      setQuizzes(quizData ?? []);

      if (!user) {
        setProgress([]);
        setSessions([]);
        setLoading(false);
        return;
      }

      const [progressResult, profileResult] = await Promise.all([
        supabase
          .from("study_progress")
          .select("quiz_id, questions_studied, correct, mastery, last_studied")
          .eq("user_id", user.id)
          .order("last_studied", { ascending: false }),
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
      <div className="container study-status-panel">
        <div className="study-status-icon">📡</div>
        <p className="study-muted">Loading study sets...</p>
      </div>
    );
  }

  if (quizError) {
    return (
      <div className="container study-status-panel">
        <div className="card study-error-card">
          <div className="study-status-icon">⚠️</div>
          <h3 className="font-display study-empty-title">Could not load study sets</h3>
          <p className="study-empty-text">{quizError}</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary mt-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="study-list-shell">
      <div className="container study-list-container">
        <div className="study-list-header">
          <div>
            <h1 className="font-display study-list-title">🧠 Study Hall</h1>
            <p className="study-list-subtitle">Master your knowledge with flashcards and quickfire practice.</p>
          </div>
          {user && (
            <div className="study-xp-badge">
              <span className="study-xp-badge-icon">⭐</span>
              <span className="study-xp-badge-value">{totalXp.toLocaleString()} XP</span>
            </div>
          )}
        </div>

        {!user && (
          <div className="card study-login-hint">
            Sign in to save study progress and earn XP across sessions.
          </div>
        )}

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

        {studiedQuizzes.length > 0 && (
          <>
            <h2 className="study-section-title">Continue Studying</h2>
            <div className="study-card-grid">
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

        <h2 className="study-section-title">Ready to Study</h2>
        {availableQuizzes.length === 0 ? (
          <div className="card study-empty-card">
            <div className="study-empty-icon">
              {studiedQuizzes.length === 0 ? "📝" : "🎉"}
            </div>
            {studiedQuizzes.length === 0 ? (
              <>
                <h3 className="font-display study-empty-title">No study sets available</h3>
                <p className="study-empty-text">Create a quiz or explore public quizzes to get started.</p>
                <div className="study-empty-actions">
                  <Link href="/explore" className="btn btn-secondary">Browse Public Quizzes</Link>
                  <Link href="/create" className="btn btn-primary">Create Quiz</Link>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-display study-empty-title">All caught up!</h3>
                <p className="study-empty-text">You've studied everything available. Create a quiz to add more.</p>
                <Link href="/create" className="btn btn-primary mt-sm inline-flex">
                  Create Quiz
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="study-card-grid">
            {availableQuizzes.map((quiz) => (
              <AvailableStudyQuizCard key={quiz.id} quiz={quiz} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

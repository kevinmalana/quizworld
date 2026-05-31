"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { AvailableStudyQuizCard, ContinueStudyQuizCard } from "@/components/study/study-quiz-card";
import { StudyStatsDashboard, type StudyProgressRow, type StudySessionRow } from "@/components/study/study-dashboard";
import { calcLevel } from "@/components/study/study-session-panels";

function XpGuideBox() {
  const [open, setOpen] = useState(false);
  return (
    <div className="study-xp-guide">
      <div className="study-xp-guide__header" onClick={() => setOpen(o => !o)}>
        <span className="study-xp-guide__title">💡 How to earn XP &amp; level up</span>
        <span className="study-xp-guide__toggle">{open ? "Hide ▲" : "Show ▼"}</span>
      </div>
      {open && (
        <div className="study-xp-guide__body">
          <div className="study-xp-guide__rows">
            <div className="study-xp-guide__row"><span>🇦️ Flashcard — correct answer</span><span>+25 XP</span></div>
            <div className="study-xp-guide__row"><span>⚡ Quick Fire — correct answer</span><span>+45 XP</span></div>
            <div className="study-xp-guide__row"><span>✅ Complete any session</span><span>+50 XP</span></div>
            <div className="study-xp-guide__row"><span>🏆 Perfect score (100%)</span><span>+100 XP bonus</span></div>
            <div className="study-xp-guide__row"><span>🔥 Study daily to grow your streak</span><span>keeps streak</span></div>
          </div>
          <div className="study-xp-guide__levels">
            <strong>Level milestones:</strong> Curious Learner (1) → Quiz Starter (2) → Knowledge Seeker (3) → Trivia Enthusiast (4) → Quiz Apprentice (5) → Study Scout (6) → Brain Trainer (7) → Quiz Adept (8) →… Master Learner (15) → Quiz Legend (20) → Grand Scholar (25) → Trivia Grandmaster (30+)
          </div>
        </div>
      )}
    </div>
  );
}


type QuizRow = {
  id: string;
  title: string;
  emoji: string | null;
  color: string | null;
  category: string;
  questions?: { count: number }[];
};

export default function StudyListPage() {
  const { user, loading: authLoading } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [progress, setProgress] = useState<StudyProgressRow[]>([]);
  const [sessions, setSessions] = useState<StudySessionRow[]>([]);
  const [profile, setProfile] = useState<{ total_xp: number; study_streak: number; longest_streak: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    if (authLoading) return;
    let ignore = false;

    async function fetchData() {
      setLoading(true);
      setQuizError(null);

      const quizQuery = supabase
        .from("quizzes")
        .select("id, title, emoji, color, category, questions(count)")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        // No limit — fetch full catalog

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

      const [progressResult, sessionResult, profileResult] = await Promise.all([
        supabase
          .from("study_progress")
          .select("quiz_id, questions_studied, correct, mastery, last_studied")
          .eq("user_id", user.id)
          .order("last_studied", { ascending: false }),
        supabase
          .from("study_sessions")
          .select("id, xp_earned, correct, total, study_mode, duration_secs, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
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

      setSessions(sessionResult.data ?? []);

      if (profileResult.data) {
        setProfile(profileResult.data as any);
      }

      setLoading(false);
    }

    fetchData();
    return () => { ignore = true; };
  }, [user?.id, authLoading]);

  const progressByQuizId = useMemo(
    () => new Map(progress.map((entry) => [entry.quiz_id, entry])),
    [progress]
  );

  const allCategories = useMemo(() => {
    const cats = Array.from(new Set(quizzes.map((q) => q.category).filter(Boolean)));
    return ["All", ...cats.sort()];
  }, [quizzes]);

  const filteredQuizzes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quizzes.filter((quiz) => {
      const matchesSearch = !q || quiz.title.toLowerCase().includes(q) || quiz.category?.toLowerCase().includes(q);
      const matchesCat = activeCategory === "All" || quiz.category === activeCategory;
      return matchesSearch && matchesCat;
    });
  }, [quizzes, search, activeCategory]);

  const studiedQuizzes = filteredQuizzes.filter((quiz) => progressByQuizId.has(quiz.id));
  const availableQuizzes = filteredQuizzes.filter((quiz) => !progressByQuizId.has(quiz.id));

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

  const isFiltering = search.trim().length > 0 || activeCategory !== "All";

  return (
    <div className="study-list-shell">
      <div className="container study-list-container">
        <div className="study-list-header">
          <div>
            <h1 className="font-display study-list-title">🧠 Study Hall</h1>
            <p className="study-list-subtitle">Master your knowledge with flashcards and quickfire practice.</p>
          </div>
          {user && (() => { const lv = calcLevel(totalXp); return (
            <div className="study-xp-badge">
              <span className="study-xp-badge-icon">⭐</span>
              <span className="study-xp-badge-value">Lv {lv.level} · {lv.title}</span>
            </div>
          ); })()}
        </div>

        {/* Search + filter — always at top so results appear immediately below */}
        <div className="study-filter-bar">
          <input
            className="study-search-input"
            type="search"
            placeholder="Search study sets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {allCategories.length > 2 && (
          <div className="study-category-chips">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`study-category-chip${activeCategory === cat ? " is-active" : ""}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Result count shown when filtering */}
        {isFiltering && (
          <p className="study-filter-results">
            {filteredQuizzes.length === 0
              ? "No matching quizzes"
              : `${filteredQuizzes.length} result${filteredQuizzes.length !== 1 ? "s" : ""}`}
          </p>
        )}

        {/* Stats collapsed when user is actively filtering */}
        {!isFiltering && !user && (
          <div className="card study-login-hint">
            Sign in to save study progress and earn XP across sessions.
          </div>
        )}

        {!isFiltering && <XpGuideBox />}

        {!isFiltering && user && (
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

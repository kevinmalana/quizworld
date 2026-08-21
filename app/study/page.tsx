"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { AvailableStudyQuizCard, ContinueStudyQuizCard } from "@/components/study/study-quiz-card";
import { StudyStatsDashboard, type StudyProgressRow, type StudySessionRow } from "@/components/study/study-dashboard";
import { calcLevel } from "@/components/study/study-session-panels";
import { CATEGORY_COLORS } from "@/lib/shared";
import { buildLoginHref } from "@/lib/auth/redirects";
import { canonicalizeCategory, categoryVariants, formatCatalogCount, mergeCatalogPage } from "@/lib/catalog-discovery";

const STUDY_PAGE_SIZE = 24;
const STUDY_CATEGORIES = ["All", ...new Set(Object.keys(CATEGORY_COLORS).map(canonicalizeCategory))];

function XpGuideBox() {
  const [open, setOpen] = useState(false);
  return (
    <div className="study-xp-guide">
      <button type="button" className="study-xp-guide__header" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="study-xp-guide__title">💡 How to earn XP &amp; level up</span>
        <span className="study-xp-guide__toggle">{open ? "Hide ▲" : "Show ▼"}</span>
      </button>
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
  created_at: string;
  questions?: { id: string }[];
};

export default function StudyListPage() {
  const { user, loading: authLoading } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const catalogCursorRef = useRef<{ createdAt: string; id: string } | null>(null);
  const catalogLoadedRef = useRef(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [assignedQuizIds, setAssignedQuizIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<StudyProgressRow[]>([]);
  const [sessions, setSessions] = useState<StudySessionRow[]>([]);
  const [profile, setProfile] = useState<{ total_xp: number; study_streak: number; longest_streak: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadCatalogPage = useCallback(async (pageIndex: number, append: boolean) => {
    const cursor = append ? catalogCursorRef.current : null;
    let query = supabase
      .from("quizzes")
      .select("id, title, emoji, color, category, created_at, questions(id)")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
    let countQuery = supabase
      .from("quizzes")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null);

    if (user) {
      const scope = `is_public.eq.true,creator_id.eq.${user.id}`;
      query = query.or(scope);
      countQuery = countQuery.or(scope);
    } else {
      query = query.eq("is_public", true);
      countQuery = countQuery.eq("is_public", true);
    }
    if (debouncedSearch) {
      query = query.ilike("title", `%${debouncedSearch}%`);
      countQuery = countQuery.ilike("title", `%${debouncedSearch}%`);
    }
    if (activeCategory !== "All") {
      const variants = categoryVariants(activeCategory);
      query = query.in("category", variants);
      countQuery = countQuery.in("category", variants);
    }
    if (cursor) {
      const createdAt = `"${cursor.createdAt.replace(/"/g, '\\"')}"`;
      query = query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.gt.${cursor.id})`);
    }
    query = query.limit(STUDY_PAGE_SIZE);

    const [{ data, error }, { count, error: countError }] = await Promise.all([query, countQuery]);
    if (error || countError) {
      console.error("Error loading study quizzes:", error || countError);
      setQuizError("Could not load study sets. Please try again.");
      if (!append) setQuizzes([]);
      return false;
    }

    const rows = (data ?? []).map(row => ({ ...row, category: canonicalizeCategory(row.category) })) as QuizRow[];
    const exactTotal = count ?? rows.length;
    setQuizzes(current => append ? mergeCatalogPage(current, rows) : rows);
    setTotalCount(exactTotal);
    const loaded = (append ? catalogLoadedRef.current : 0) + rows.length;
    catalogLoadedRef.current = loaded;
    setHasMore(loaded < exactTotal);
    const last = rows[rows.length - 1];
    if (last) catalogCursorRef.current = { createdAt: last.created_at, id: last.id };
    else if (!append) catalogCursorRef.current = null;
    setPage(pageIndex);
    return true;
  }, [activeCategory, debouncedSearch, user?.id]);

  useEffect(() => {
    if (authLoading) return;
    let ignore = false;

    async function fetchData() {
      setLoading(true);
      setQuizError(null);
      const catalogLoaded = await loadCatalogPage(0, false);
      if (ignore) return;
      if (!catalogLoaded) {
        setLoading(false);
        return;
      }

      if (!user) {
        setProgress([]);
        setSessions([]);
        setLoading(false);
        return;
      }

      const [progressResult, sessionResult, profileResult, membershipResult] = await Promise.all([
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
        supabase
          .from("classroom_members")
          .select("classroom_id")
          .eq("user_id", user.id),
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

      const classroomIds = (membershipResult.data ?? []).map(membership => membership.classroom_id);
      if (classroomIds.length > 0) {
        const { data: assignmentRows } = await supabase
          .from("classroom_assignments")
          .select("quiz_id")
          .in("classroom_id", classroomIds);
        const ids = [...new Set((assignmentRows ?? []).map(assignment => assignment.quiz_id))];
        setAssignedQuizIds(new Set(ids));
        if (ids.length > 0) {
          const { data: assignedRows } = await supabase
            .from("quizzes")
            .select("id, title, emoji, color, category, created_at, questions(id)")
            .in("id", ids);
          if (!ignore && assignedRows) {
            const normalized = assignedRows.map(row => ({ ...row, category: canonicalizeCategory(row.category) })) as QuizRow[];
            setQuizzes(current => mergeCatalogPage(normalized, current));
          }
        }
      } else {
        setAssignedQuizIds(new Set());
      }

      setLoading(false);
    }

    fetchData();
    return () => { ignore = true; };
  }, [user?.id, authLoading, loadCatalogPage]);

  const progressByQuizId = useMemo(
    () => new Map(progress.map((entry) => [entry.quiz_id, entry])),
    [progress]
  );

  const allCategories = STUDY_CATEGORIES;

  const filteredQuizzes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return quizzes.filter((quiz) => {
      const matchesSearch = !query || quiz.title.toLowerCase().includes(query) || quiz.category.toLowerCase().includes(query);
      const matchesCategory = activeCategory === "All" || canonicalizeCategory(quiz.category) === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [quizzes, search, activeCategory]);

  const studiedQuizzes = filteredQuizzes.filter((quiz) => progressByQuizId.has(quiz.id));
  const assignedQuizzes = filteredQuizzes.filter((quiz) => assignedQuizIds.has(quiz.id) && !progressByQuizId.has(quiz.id));
  const preferredCategories = new Set(
    progress.flatMap(entry => {
      const quiz = quizzes.find(candidate => candidate.id === entry.quiz_id);
      return quiz ? [canonicalizeCategory(quiz.category)] : [];
    })
  );
  const recommendedQuizzes = filteredQuizzes
    .filter(quiz => !progressByQuizId.has(quiz.id) && !assignedQuizIds.has(quiz.id) && preferredCategories.has(canonicalizeCategory(quiz.category)))
    .slice(0, 6);
  const featuredIds = new Set([...assignedQuizzes, ...recommendedQuizzes].map(quiz => quiz.id));
  const availableQuizzes = filteredQuizzes.filter((quiz) => !progressByQuizId.has(quiz.id) && !featuredIds.has(quiz.id));

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

  async function handleLoadMore() {
    setLoadingMore(true);
    await loadCatalogPage(page + 1, true);
    setLoadingMore(false);
  }

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

        {!loading && (
          <p className="study-filter-results" aria-live="polite">
            {formatCatalogCount(filteredQuizzes.length, totalCount, "study set")}
          </p>
        )}

        {/* Stats collapsed when user is actively filtering */}
        {!isFiltering && !user && (
          <div className="card study-login-hint">
            <span>Sign in to save study progress and earn XP across sessions.</span>
            <Link href={buildLoginHref("/study")} className="btn btn-primary btn-compact">Sign in</Link>
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

        {assignedQuizzes.length > 0 && (
          <>
            <h2 className="study-section-title">Assigned to You</h2>
            <div className="study-card-grid">
              {assignedQuizzes.map((quiz) => <AvailableStudyQuizCard key={quiz.id} quiz={quiz} />)}
            </div>
          </>
        )}

        {recommendedQuizzes.length > 0 && (
          <>
            <h2 className="study-section-title">Recommended for You</h2>
            <div className="study-card-grid">
              {recommendedQuizzes.map((quiz) => <AvailableStudyQuizCard key={quiz.id} quiz={quiz} />)}
            </div>
          </>
        )}

        <h2 className="study-section-title">Browse Study Sets</h2>
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
        {hasMore && (
          <div className="study-load-more">
            <button className="btn btn-secondary" type="button" disabled={loadingMore} onClick={() => void handleLoadMore()}>
              {loadingMore ? "Loading..." : "Load more study sets"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { calcLevel } from "@/components/study/study-session-panels";

import { CATEGORY_COLORS, CATEGORY_EMOJIS } from "@/lib/shared";
import { canonicalizeCategory, catalogQuestionCount, formatCatalogCount, mergeCatalogPage, fetchCatalogPage, normalizeCatalogSearch, catalogCursorForRow, type CatalogCursor } from "@/lib/catalog-discovery";
import { ExploreQuizCard, type QuizWithCreator } from "@/components/explore/explore-quiz-card";
import { type CategoryFamilyId } from "@/lib/category-families";
import type { InitialExploreCatalog } from "@/lib/catalog-server";

const CATEGORY_LIST = ["All", ...new Set(Object.keys(CATEGORY_COLORS).map(canonicalizeCategory))];
const PAGE_SIZE = 24;

type SortMode = "popular" | "newest" | "az" | "za";
type FailedCatalogRequest = { append: boolean; options: Parameters<typeof fetchCatalogPage>[1] };

const SORT_OPTIONS: { value: SortMode; label: string; icon: string }[] = [
  { value: "popular", label: "Most Played", icon: "🔥" },
  { value: "newest", label: "Newest", icon: "✨" },
  { value: "az", label: "A → Z", icon: "🔤" },
  { value: "za", label: "Z → A", icon: "🔤" },
];

type SuperCategory = {
  id: CategoryFamilyId;
  label: string;
  emoji: string;
  subcategories: string[];
};

const SUPER_CATEGORIES: SuperCategory[] = [
  {
    id: "academic",
    label: "Academic",
    emoji: "🎓",
    subcategories: [
      "Science & Nature", "Math", "History", "Geography",
      "Psychology & Mind", "Health & Medicine", "Languages",
    ],
  },
  {
    id: "entertainment",
    label: "Entertainment",
    emoji: "🎬",
    subcategories: [
      "Movies", "TV Shows", "Music", "Pop Culture",
      "Celebrities", "Comics & Anime", "Video Games",
    ],
  },
  {
    id: "professional",
    label: "Professional",
    emoji: "💼",
    subcategories: [
      "Technology", "Programming", "Business", "Social Media & Internet",
    ],
  },
  {
    id: "world",
    label: "World",
    emoji: "🌍",
    subcategories: [
      "Travel & Tourism", "Politics & Government", "Current Events",
      "Religion & Spirituality", "Mythology & Folklore",
    ],
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    emoji: "⚽",
    subcategories: [
      "Sports", "Food & Drink", "Animals & Pets", "Nature & Environment",
      "Fashion & Style", "DIY & Crafts", "Cars & Automotive",
      "Relationships & Dating", "Holidays & Celebrations",
      "Art & Literature", "Photography",
    ],
  },
  {
    id: "discovery",
    label: "Discovery",
    emoji: "🔬",
    subcategories: [
      "General Knowledge", "Trivia", "Inventions & Discoveries", "Other",
    ],
  },
];

function SurpriseModal({
  quiz,
  onSkip,
  onClose,
}: {
  quiz: QuizWithCreator;
  onSkip: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialogRef.current?.showModal(); }, []);
  return (
    <dialog ref={dialogRef} aria-label="Surprise Quiz" onCancel={onClose}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%", maxWidth: "100%", height: "100dvh", maxHeight: "100dvh", border: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-xl)",
          padding: "2rem",
          maxWidth: 420,
          width: "100%",
          position: "relative",
          boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
        }}
        className="animate-pop-in"
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "var(--bg-subtle)",
            border: "1px solid var(--line)",
            borderRadius: "50%",
            width: 32,
            height: 32,
            cursor: "pointer",
            fontSize: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--muted)",
          }}
          aria-label="Close"
        >
          ✕
        </button>

        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎲</div>
          <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Surprise Quiz
          </p>
        </div>

        <div
          style={{
            background: `${quiz.color || "#7c3aed"}12`,
            border: `1px solid ${quiz.color || "#7c3aed"}30`,
            borderRadius: "var(--radius-lg)",
            padding: "1.25rem",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
            {quiz.emoji || CATEGORY_EMOJIS[quiz.category] || "📌"}
          </div>
          <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--ink)", marginBottom: "0.5rem" }}>
            {quiz.title}
          </h3>
          <span className="tag" style={{ marginBottom: "0.75rem", display: "inline-block" }}>{quiz.category}</span>
          <div style={{ display: "flex", gap: "1rem", fontSize: "0.8125rem", color: "var(--muted)", flexWrap: "wrap" }}>
            <span>📝 {catalogQuestionCount(quiz)} questions</span>
            <span>▶️ {quiz.plays.toLocaleString()} plays</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.625rem" }}>
          <Link
            prefetch={false}
            href={`/quiz/${quiz.slug || quiz.id}`}
            className="btn btn-primary"
            style={{ flex: 1, textAlign: "center" }}
            onClick={onClose}
          >
            View quiz
          </Link>
          <button
            onClick={onSkip}
            className="btn btn-secondary"
            style={{ flex: 1 }}
          >
            ⏭ Skip
          </button>
        </div>
      </div>
    </dialog>
  );
}

function SuperCategorySelector({
  activeCategory,
  onCategoryChange,
}: {
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
}) {
  const [expandedSuperCat, setExpandedSuperCat] = useState<CategoryFamilyId | null>(null);

  // Determine which super-cat (if any) owns the active subcategory
  const activeSuperCat = useMemo(() => {
    if (activeCategory === "All") return null;
    return SUPER_CATEGORIES.find((sc) => sc.subcategories.includes(activeCategory))?.id ?? null;
  }, [activeCategory]);

  function handleSuperClick(sc: SuperCategory) {
    if (expandedSuperCat === sc.id) {
      setExpandedSuperCat(null);
    } else {
      setExpandedSuperCat(sc.id);
    }
  }

  return (
    <div className="explore-family-selector">
      <div className="explore-family-strip hide-scrollbar" role="group" aria-label="Quiz families">
        <button
          onClick={() => { onCategoryChange("All"); setExpandedSuperCat(null); }}
          className={`explore-family-card explore-family-card--all ${activeCategory === "All" && expandedSuperCat === null ? "is-active" : ""}`}
          aria-pressed={activeCategory === "All" && expandedSuperCat === null}
        >
          <span className="explore-family-all-icon" aria-hidden="true">🌐</span>
          <span className="explore-family-label">All topics</span>
          <span className="explore-family-hint">Browse everything</span>
        </button>

        {SUPER_CATEGORIES.map((sc, index) => {
          const isExpanded = expandedSuperCat === sc.id;
          const hasActiveSub = activeSuperCat === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => handleSuperClick(sc)}
              className={`explore-family-card ${isExpanded || hasActiveSub ? "is-active" : ""}`}
              aria-expanded={isExpanded}
              aria-pressed={hasActiveSub}
              aria-controls="explore-family-subcategories"
            >
              <span className="explore-family-card-content">
                <span className="explore-family-label">{sc.emoji} {sc.label}</span>
                <span className="explore-family-chevron" aria-hidden="true">{isExpanded ? "▲" : "▼"}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Expanded subcategories inline */}
      {expandedSuperCat && (
        <div
          id="explore-family-subcategories"
          className="hide-scrollbar"
          style={{
            display: "flex",
            gap: "0.3rem",
            overflowX: "auto",
            paddingBottom: "0.25rem",
            flexWrap: "nowrap",
            background: "var(--bg-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "0.625rem",
            border: "1px solid var(--line)",
          }}
        >
          {SUPER_CATEGORIES.find((sc) => sc.id === expandedSuperCat)?.subcategories.map((sub) => (
            <button
              key={sub}
              onClick={() => { onCategoryChange(sub); setExpandedSuperCat(null); }}
              className={activeCategory === sub ? "btn btn-chip explore-chip is-active" : "btn btn-chip explore-chip"}
              style={{ flexShrink: 0 }}
            >
              {CATEGORY_EMOJIS[sub] || "📌"} {sub}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page content ───────────────────────────────────────────────────────

function ExplorePageContent({
  initialCatalog,
  initialCategory,
}: {
  initialCatalog: InitialExploreCatalog | null;
  initialCategory: string;
}) {
  const { user } = useAuth();
  const seededCatalog = initialCatalog;
  const [quizzes, setQuizzes] = useState<QuizWithCreator[]>(seededCatalog?.quizzes ?? []);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const normalizedSearch = normalizeCatalogSearch(search);
  const [activeCategory, setActiveCategory] = useState(
    CATEGORY_LIST.includes(canonicalizeCategory(initialCategory)) && initialCategory !== "All"
      ? canonicalizeCategory(initialCategory) : "All"
  );
  const [sortMode, setSortMode] = useState<SortMode>("popular");
  const [loading, setLoading] = useState(!seededCatalog);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [failedRequest, setFailedRequest] = useState<FailedCatalogRequest | null>(null);
  const [hasMore, setHasMore] = useState(Boolean(seededCatalog && seededCatalog.quizzes.length < seededCatalog.totalCount));
  const [totalCount, setTotalCount] = useState(seededCatalog?.totalCount ?? 0);
  const skipInitialFetchRef = useRef(Boolean(seededCatalog));
  const requestVersion = useRef(0);
  const loadedCount = useRef(seededCatalog?.quizzes.length ?? 0);
  const catalogCursor = useRef<CatalogCursor | null>(null);
  const seedLast = seededCatalog?.quizzes.at(-1);
  if (skipInitialFetchRef.current && seedLast) catalogCursor.current = catalogCursorForRow("popular", {
    id: seedLast.id, title: seedLast.title, plays: seedLast.plays, created_at: "",
  });
  const [surpriseQuiz, setSurpriseQuiz] = useState<QuizWithCreator | null>(null);
  const [surprisePool, setSurprisePool] = useState<QuizWithCreator[]>([]);

  async function fetchPage(append: boolean, retry?: FailedCatalogRequest) {
    const version = ++requestVersion.current;
    const options = retry?.options ?? {
      search: normalizedSearch, category: activeCategory, sort: sortMode,
      loadedCount: append ? loadedCount.current : 0,
      cursor: append ? catalogCursor.current : null, pageSize: PAGE_SIZE,
    };
    if (append) setLoadingMore(true);
    else { setLoading(true); setLoadingMore(false); }
    setFetchError(null);
    setFailedRequest(null);
    try {
      const offset = options.loadedCount ?? 0;
      const result = await fetchCatalogPage(supabase, options);
      if (version !== requestVersion.current) return;
      const batch = result.quizzes;
      let withCreator: QuizWithCreator[] = [];

      const creatorIds = [...new Set(batch.map((q: any) => q.creator_id).filter(Boolean))];
      let creatorMap: Record<string, { name: string; username: string; avatar: string; level: number; levelTitle: string }> = {};

      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar, total_xp")
          .in("id", creatorIds);
        if (profiles) {
          for (const p of profiles) {
            const lv = calcLevel((p.total_xp as number) ?? 0);
            creatorMap[p.id] = {
              name: p.display_name || p.username || "",
              username: p.username || "",
              avatar: p.avatar || "👤",
              level: lv.level,
              levelTitle: lv.title,
            };
          }
        }
      }

      withCreator = batch.map((q: any) => ({
        ...q,
        creator_name: creatorMap[q.creator_id]?.name ?? undefined,
        creator_display_name: creatorMap[q.creator_id]?.name ?? undefined,
        creator_username: creatorMap[q.creator_id]?.username ?? undefined,
        creator_avatar: creatorMap[q.creator_id]?.avatar ?? undefined,
        creator_level: creatorMap[q.creator_id]?.level ?? undefined,
        creator_level_title: creatorMap[q.creator_id]?.levelTitle ?? undefined,
      })) as QuizWithCreator[];

      if (version !== requestVersion.current) return;
      loadedCount.current = offset + batch.length;
      catalogCursor.current = result.nextCursor;
      setQuizzes(prev => append ? mergeCatalogPage(prev, withCreator) : withCreator);
      setTotalCount(result.totalCount);
      setHasMore(result.hasMore);
    } catch {
      if (version === requestVersion.current) {
        setFetchError("Could not load the quiz catalog. Please try again.");
        setFailedRequest({append, options});
      }
    } finally {
      if (version === requestVersion.current) { setLoading(false); setLoadingMore(false); }
    }
  }

  useEffect(() => {
    if (skipInitialFetchRef.current && !normalizedSearch && sortMode === "popular") {
      skipInitialFetchRef.current = false;
      return;
    }
    skipInitialFetchRef.current = false;
    // Invalidate old requests immediately, including delayed creator enrichment.
    ++requestVersion.current;
    setFailedRequest(null);
    setFetchError(null);
    setLoading(true);
    const timer = setTimeout(() => { void fetchPage(false); }, normalizedSearch ? 300 : 0);
    return () => { clearTimeout(timer); ++requestVersion.current; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedSearch, activeCategory, sortMode]);

  function handleLoadMore() {
    if (!loading && !loadingMore && hasMore) void fetchPage(true);
  }

  useEffect(() => {
    if (quizzes.length > 0) setSurprisePool(quizzes);
  }, [quizzes]);

  function handleSurpriseMe() {
    const pool = surprisePool.length > 0 ? surprisePool : quizzes;
    if (pool.length === 0) return;
    const idx = Math.floor(Math.random() * pool.length);
    setSurpriseQuiz(pool[idx]);
  }

  function handleSurpriseSkip() {
    const pool = surprisePool.length > 0 ? surprisePool : quizzes;
    if (pool.length === 0) return;
    // Pick a different quiz
    let idx = Math.floor(Math.random() * pool.length);
    if (surpriseQuiz && pool.length > 1) {
      while (pool[idx]?.id === surpriseQuiz.id) {
        idx = Math.floor(Math.random() * pool.length);
      }
    }
    setSurpriseQuiz(pool[idx]);
  }

  const hasActiveFilter = activeCategory !== "All" || search.trim().length > 0;

  // The server query is the single source for matching, counts and ordering.
  const filtered = quizzes;

  const catalogGridQuizzes = filtered;

  const catalogDescription = loading
    ? "Searching across all quizzes…"
    : formatCatalogCount(filtered.length, totalCount, hasActiveFilter ? "result" : "public quiz");

  return (
    <div className="explore-page">
      {/* Surprise me modal */}
      {surpriseQuiz && (
        <SurpriseModal
          quiz={surpriseQuiz}
          onSkip={handleSurpriseSkip}
          onClose={() => setSurpriseQuiz(null)}
        />
      )}

      <div className="container explore-container">
        {/* Hero section */}
        <section className="explore-hero animate-pop-in">
          <h1 className="font-display home-hero-title">
            Discover Quizzes
          </h1>

          <p className="home-hero-desc">
            Search public quiz sets, jump into host mode, or study a topic at your own pace.
          </p>

          <div className="home-hero-actions">
            <Link prefetch={false} href="/host" className="btn btn-secondary">Host a Game</Link>
            <Link prefetch={false} href="/create" className="text-link">Create a Quiz</Link>
          </div>
        </section>

        {/* Search + Sort + Super-category filter */}
        <section className="explore-controls" aria-label="Find your next round">
          <div className="explore-filter-col">
            <div className="explore-search-row">
              <input
                ref={searchInputRef}
                type="search"
                aria-label="Search public quizzes"
                placeholder="Search titles or categories"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="explore-search-input"
              />
              {search.length > 0 && <button type="button" className="btn btn-secondary explore-clear-search" onClick={() => { setSearch(""); searchInputRef.current?.focus(); }}>Clear search</button>}

              <div className="explore-sort-row">
                <span className="explore-sort-label">Sort:</span>
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortMode(opt.value)}
                    title={opt.label}
                    aria-pressed={sortMode === opt.value}
                    className={sortMode === opt.value ? "btn btn-pill explore-sort-btn is-active" : "btn btn-pill explore-sort-btn"}
                  >
                    <span className="explore-sort-icon">{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
                <span className="explore-results-badge" role="status">{loading ? "Searching…" : fetchError ? "Search unavailable" : `${totalCount} results`}</span>
              </div>
            </div>

            {/* Super-category selector (replaces flat chip row) */}
            <details className="explore-topics">
              <summary><span>Browse topics</span><span>{activeCategory === "All" ? "All topics" : activeCategory}</span></summary>
              <SuperCategorySelector activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
            </details>
          </div>
        </section>

        {/* Main content area */}
        {loading ? (
          <div className="explore-status-panel explore-status-panel--loading">
            <div className="explore-status-icon">📡</div>
            <p className="font-600">Loading quizzes...</p>
          </div>
        ) : fetchError && !failedRequest?.append ? (
          <div className="explore-status-panel">
            <div className="explore-status-icon">⚠️</div>
            <h3 className="font-display explore-status-title">Could not load quizzes</h3>
            <p className="explore-status-text">{fetchError}</p>
            <button onClick={() => void fetchPage(false, failedRequest ?? undefined)} className="btn btn-primary mt-sm">
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          hasActiveFilter ? (
            <div className="explore-status-panel">
              <div className="explore-status-icon">🔍</div>
              <h3 className="font-display explore-status-title">No quizzes match your search</h3>
              <p className="explore-status-text">
                Try different keywords or remove the{activeCategory !== "All" ? " category filter" : " search"}.
              </p>
              {(search.trim().length > 0 || activeCategory !== "All") && (
                <button
                  onClick={() => { setSearch(""); setActiveCategory("All"); }}
                  className="btn btn-secondary mt-sm"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="explore-status-panel">
              <div className="explore-status-icon">📝</div>
              <h3 className="font-display explore-status-title">No public quizzes yet</h3>
              <p className="explore-status-text">Be the first to create and share a quiz!</p>
              <Link prefetch={false} href="/create" className="btn btn-primary mt-sm inline-flex">
                Create Quiz
              </Link>
            </div>
          )
        ) : (
          <>
            {/* Main grid / search results */}
            <section className="explore-results" aria-label="Quiz results">
              <header className="explore-results-heading"><h2 className="font-display">{hasActiveFilter ? "Search Results" : "All Quizzes"}</h2><p>{catalogDescription}</p></header>
              <div className="grid-3">
                {catalogGridQuizzes.map((q) => (
                  <ExploreQuizCard key={q.id} quiz={q} />
                ))}
              </div>
              {failedRequest?.append && (
                <div className="explore-load-more" role="status">
                  <p>{fetchError}</p>
                  <button className="btn btn-secondary" onClick={() => void fetchPage(true, failedRequest)}>Retry loading more</button>
                </div>
              )}
              {hasMore && !failedRequest?.append && (
                <div className="explore-load-more">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="btn btn-secondary"
                  >
                    {loadingMore ? "Loading..." : "Load more quizzes"}
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Surprise Me floating button */}
      {!loading && quizzes.length > 0 && (
        <button
          onClick={handleSurpriseMe}
          className="btn btn-primary explore-surprise-button"
          aria-label="Surprise Me — pick a random quiz"
          title="Pick a random quiz"
        >
          <span aria-hidden="true">🎲</span>
          <span className="explore-surprise-label">Surprise me</span>
        </button>
      )}


    </div>
  );
}

export default function ExploreClient({
  initialCatalog,
  initialCategory,
}: {
  initialCatalog: InitialExploreCatalog | null;
  initialCategory: string;
}) {
  return <ExplorePageContent initialCatalog={initialCatalog} initialCategory={initialCategory} />;
}

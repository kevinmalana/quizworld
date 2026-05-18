"use client";

import Link from "next/link";
import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { SectionCard } from "@/components/section-card";
import { calcLevel } from "@/components/study/study-session-panels";

import { CATEGORY_COLORS, CATEGORY_EMOJIS } from "@/lib/store";
import { ExploreQuizCard, type QuizWithCreator } from "@/components/explore/explore-quiz-card";

const CATEGORY_LIST = ["All", ...Object.keys(CATEGORY_COLORS)];

const PAGE_SIZE = 24;

type SortMode = "popular" | "newest" | "az" | "za";

const SORT_OPTIONS: { value: SortMode; label: string; icon: string }[] = [
  { value: "popular", label: "Most Played", icon: "🔥" },
  { value: "newest", label: "Newest", icon: "✨" },
  { value: "az", label: "A → Z", icon: "🔤" },
  { value: "za", label: "Z → A", icon: "🔤" },
];

function ExplorePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const categoryParam = searchParams.get("category");
  const [quizzes, setQuizzes] = useState<QuizWithCreator[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(
    categoryParam && CATEGORY_LIST.includes(categoryParam) ? categoryParam : "All"
  );
  const [sortMode, setSortMode] = useState<SortMode>("popular");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (categoryParam && CATEGORY_LIST.includes(categoryParam)) {
      setActiveCategory(categoryParam);
    }
  }, [categoryParam]);

  async function fetchPage(pageIndex: number, append: boolean) {
    if (pageIndex === 0) {
      setLoading(true);
      setFetchError(null);
    } else {
      setLoadingMore(true);
    }

    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("quizzes")
      .select("*, questions(*, answers(*))")
      .eq("is_public", true)
      .is("archived_at", null)
      .order("plays", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error fetching quizzes:", error);
      setFetchError("Could not load the quiz catalog. Please try again in a moment.");
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const batch = data ?? [];
    setHasMore(batch.length === PAGE_SIZE);

    if (batch.length > 0) {
      const creatorIds = [...new Set(batch.map((q: any) => q.creator_id).filter(Boolean))];
      let creatorMap: Record<string, { name: string; username: string; avatar: string; level: number; levelTitle: string }> = {};

      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar, total_xp")
          .in("id", creatorIds);
        if (profiles) {
          for (const p of profiles) {
            const lv = calcLevel((p.total_xp as number | null) ?? 0);
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

      const withCreator = batch.map((q: any) => ({
        ...q,
        creator_name: creatorMap[q.creator_id]?.name ?? undefined,
        creator_display_name: creatorMap[q.creator_id]?.name ?? undefined,
        creator_username: creatorMap[q.creator_id]?.username ?? undefined,
        creator_avatar: creatorMap[q.creator_id]?.avatar ?? undefined,
        creator_level: creatorMap[q.creator_id]?.level ?? undefined,
        creator_level_title: creatorMap[q.creator_id]?.levelTitle ?? undefined,
      })) as QuizWithCreator[];

      setQuizzes((prev) => append ? [...prev, ...withCreator] : withCreator);
    } else if (!append) {
      setQuizzes([]);
    }

    setLoading(false);
    setLoadingMore(false);
  }

  useEffect(() => {
    setPage(0);
    fetchPage(0, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLoadMore() {
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
  }

  const hasActiveFilter = activeCategory !== "All" || search.trim().length > 0;

  const filtered = useMemo(() => {
    let result = quizzes.filter((q) => {
      const matchCat = activeCategory === "All" || q.category === activeCategory;
      const matchSearch =
        !search.trim() ||
        q.title.toLowerCase().includes(search.toLowerCase()) ||
        q.category.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });

    if (sortMode === "popular") {
      result = [...result].sort((a, b) => b.plays - a.plays);
    } else if (sortMode === "newest") {
      result = [...result].sort((a, b) => {
        const aTime = (a as any).created_at ?? a.createdAt ?? 0;
        const bTime = (b as any).created_at ?? b.createdAt ?? 0;
        return bTime - aTime;
      });
    } else if (sortMode === "az") {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortMode === "za") {
      result = [...result].sort((a, b) => b.title.localeCompare(a.title));
    }

    return result;
  }, [quizzes, search, activeCategory, sortMode]);

  const trending = useMemo(() => {
    return [...quizzes]
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 6);
  }, [quizzes]);

  const catalogDescription = hasActiveFilter
    ? `${filtered.length} quiz${filtered.length !== 1 ? "zes" : ""} matching your filters`
    : `All ${filtered.length} public quiz${filtered.length !== 1 ? "zes" : ""}`;

  return (
    <div className="explore-page">
      <div className="mesh-gradient">
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />
      </div>

      <div className="container explore-container">
        {/* Hero section matching homepage style */}
        <section className="home-hero animate-pop-in">
          <div className="tag tag-success mb-md">
            <span className="home-tag-dot" />
            Live Multiplayer
          </div>

          <h1 className="font-display home-hero-title">
            Discover Quizzes
          </h1>

          <p className="home-hero-desc">
            Search public quiz sets, jump into host mode, or study a topic at your own pace.
          </p>

          <div className="home-hero-actions">
            <Link href="/create" className="btn btn-primary btn-lg">Create a Quiz</Link>
            <Link href="/host" className="btn btn-secondary btn-lg">Host a Game</Link>
          </div>
        </section>

        <SectionCard
          title="Search And Filter"
          description="Use category chips and keyword search to narrow the public catalog."
        >
          <div className="explore-filter-col">
            <div className="explore-search-row">
              <input
                type="text"
                placeholder="Search topics or keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-pin explore-search-input"
              />

              <div className="explore-sort-row">
                <span className="explore-sort-label">Sort:</span>
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortMode(opt.value)}
                    title={opt.label}
                    className={sortMode === opt.value ? "btn btn-pill explore-sort-btn is-active" : "btn btn-pill explore-sort-btn"}
                  >
                    <span className="explore-sort-icon">{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
                <span className="explore-results-badge">{filtered.length} results</span>
              </div>
            </div>

            <div className="hide-scrollbar explore-chip-row">
              {CATEGORY_LIST.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={activeCategory === cat ? "btn btn-chip explore-chip is-active" : "btn btn-chip explore-chip"}
                >
                  {cat === "All" ? "All topics" : `${CATEGORY_EMOJIS[cat] || "📌"} ${cat}`}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        {loading ? (
          <div className="explore-status-panel explore-status-panel--loading">
            <div className="explore-status-icon">📡</div>
            <p className="font-600">Loading quizzes...</p>
          </div>
        ) : fetchError ? (
          <div className="explore-status-panel">
            <div className="explore-status-icon">⚠️</div>
            <h3 className="font-display explore-status-title">Could not load quizzes</h3>
            <p className="explore-status-text">{fetchError}</p>
            <button onClick={() => window.location.reload()} className="btn btn-primary mt-sm">
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
              <Link href="/create" className="btn btn-primary mt-sm inline-flex">
                Create Quiz
              </Link>
            </div>
          )
        ) : (
          <>
            {!hasActiveFilter && trending.length >= 3 && (
              <div className="explore-trending">
                <div className="explore-trending-header">
                  <span className="explore-trending-icon">🔥</span>
                  <h2 className="font-display explore-trending-title">Trending Now</h2>
                  <span className="explore-trending-subtitle">Most played this week</span>
                </div>
                <div className="explore-trending-grid">
                  {trending.slice(0, 6).map((q) => (
                    <ExploreQuizCard key={q.id} quiz={q} />
                  ))}
                </div>
              </div>
            )}

            <SectionCard
              title={hasActiveFilter ? "Search Results" : "All Quizzes"}
              description={catalogDescription}
            >
              <div className="grid-3">
                {filtered.map((q) => (
                  <ExploreQuizCard key={q.id} quiz={q} />
                ))}
              </div>
              {!hasActiveFilter && hasMore && (
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
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="container explore-status-panel explore-status-panel--loading">
      <div className="explore-status-icon">📡</div>
      <p className="text-muted">Loading...</p>
    </div>}>
      <ExplorePageContent />
    </Suspense>
  );
}

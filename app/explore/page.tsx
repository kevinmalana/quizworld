"use client";

import Link from "next/link";
import { Suspense, useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { SectionCard } from "@/components/section-card";
import { calcLevel } from "@/components/study/study-session-panels";

import { CATEGORY_COLORS, CATEGORY_EMOJIS } from "@/lib/shared";
import { canonicalizeCategory, catalogCursorFilter, catalogCursorForRow, categoryVariants, excludeFeaturedQuizzes, formatCatalogCount, mergeCatalogPage, type CatalogCursor } from "@/lib/catalog-discovery";
import { ExploreQuizCard, type QuizWithCreator } from "@/components/explore/explore-quiz-card";

const CATEGORY_LIST = ["All", ...new Set(Object.keys(CATEGORY_COLORS).map(canonicalizeCategory))];
const PAGE_SIZE = 24;

type SortMode = "popular" | "newest" | "az" | "za";

const SORT_OPTIONS: { value: SortMode; label: string; icon: string }[] = [
  { value: "popular", label: "Most Played", icon: "🔥" },
  { value: "newest", label: "Newest", icon: "✨" },
  { value: "az", label: "A → Z", icon: "🔤" },
  { value: "za", label: "Z → A", icon: "🔤" },
];

type SuperCategory = {
  id: string;
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

type Collection = {
  emoji: string;
  title: string;
  subtitle: string;
  quizCount: number;
  difficulty: string;
  category: string;
  gradientFrom: string;
  gradientTo: string;
};


const COLLECTIONS: Collection[] = [
  {
    emoji: "🌍",
    title: "World Geography Series",
    subtitle: "From capitals to continents — master every region",
    quizCount: 5,
    difficulty: "Beginner → Expert",
    category: "Geography",
    gradientFrom: "#22c55e20",
    gradientTo: "#14b8a620",
  },
  {
    emoji: "💻",
    title: "Tech Interview Prep",
    subtitle: "Coding, systems, and behavioural rounds covered",
    quizCount: 8,
    difficulty: "Professional",
    category: "Programming",
    gradientFrom: "#0ea5e920",
    gradientTo: "#6366f120",
  },
  {
    emoji: "🎬",
    title: "Ultimate Movie Buff",
    subtitle: "Classic cinema to modern blockbusters",
    quizCount: 6,
    difficulty: "Pop Culture",
    category: "Movies",
    gradientFrom: "#f9731620",
    gradientTo: "#e11d4820",
  },
  {
    emoji: "🧠",
    title: "Brain Training Pack",
    subtitle: "Logic puzzles, trivia & lateral thinking",
    quizCount: 7,
    difficulty: "Mixed",
    category: "General Knowledge",
    gradientFrom: "#8b5cf620",
    gradientTo: "#a855f720",
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
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
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
            <span>📝 {quiz.questions?.length || 0} questions</span>
            <span>▶️ {quiz.plays.toLocaleString()} plays</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.625rem" }}>
          <Link
            href={`/join`}
            className="btn btn-primary"
            style={{ flex: 1, textAlign: "center" }}
            onClick={onClose}
          >
            🎮 Play Now
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
    </div>
  );
}

function CollectionCard({
  collection,
  onCategorySelect,
}: {
  collection: Collection;
  onCategorySelect: (cat: string) => void;
}) {
  return (
    <div
      className="card card-hover"
      style={{
        background: `linear-gradient(135deg, ${collection.gradientFrom}, ${collection.gradientTo})`,
        border: "1px solid var(--line)",
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: "2rem" }}>{collection.emoji}</div>
      <h3 className="font-display" style={{ fontSize: "1rem", fontWeight: 800, color: "var(--ink)", lineHeight: 1.3 }}>
        {collection.title}
      </h3>
      <p style={{ fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.5, flexGrow: 1 }}>
        {collection.subtitle}
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            background: "var(--surface)",
            color: "var(--muted)",
            borderRadius: "999px",
            padding: "0.2rem 0.55rem",
            border: "1px solid var(--line)",
          }}
        >
          {collection.difficulty}
        </span>
      </div>
      <button
        onClick={() => onCategorySelect(collection.category)}
        className="btn btn-secondary btn-compact"
        style={{ marginTop: "0.75rem", alignSelf: "flex-start" }}
      >
        Explore →
      </button>
    </div>
  );
}

function TrendingRow({
  title,
  quizzes,
  onSeeAll,
}: {
  title: string;
  quizzes: QuizWithCreator[];
  onSeeAll: () => void;
}) {
  if (quizzes.length === 0) return null;

  return (
    <div style={{ marginBottom: "2.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", gap: "0.75rem" }}>
        <h2 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--ink)" }}>
          {title}
        </h2>
        <button
          onClick={onSeeAll}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--accent)",
            fontSize: "0.825rem",
            fontWeight: 700,
            whiteSpace: "nowrap",
            padding: "0.25rem 0",
          }}
        >
          See all →
        </button>
      </div>

      {/* Mobile: horizontal scroll; Desktop: 3-col grid */}
      <div
        className="trending-row-scroll"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1rem",
        }}
      >
        {quizzes.slice(0, 6).map((q) => (
          <ExploreQuizCard key={q.id} quiz={q} />
        ))}
      </div>
    </div>
  );
}

function SuperCategorySelector({
  activeCategory,
  onCategoryChange,
}: {
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
}) {
  const [expandedSuperCat, setExpandedSuperCat] = useState<string | null>(null);

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
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Top row: All + super-category buttons */}
      <div
        className="hide-scrollbar"
        style={{ display: "flex", gap: "0.375rem", overflowX: "auto", paddingBottom: "0.25rem", flexWrap: "nowrap" }}
      >
        {/* All button */}
        <button
          onClick={() => { onCategoryChange("All"); setExpandedSuperCat(null); }}
          className={activeCategory === "All" ? "btn btn-chip explore-chip is-active" : "btn btn-chip explore-chip"}
        >
          🌐 All topics
        </button>

        {SUPER_CATEGORIES.map((sc) => {
          const isExpanded = expandedSuperCat === sc.id;
          const hasActiveSub = activeSuperCat === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => handleSuperClick(sc)}
              className="btn btn-chip explore-chip"
              style={{
                background: hasActiveSub
                  ? "var(--accent)"
                  : isExpanded
                  ? "var(--bg-subtle)"
                  : "var(--surface)",
                color: hasActiveSub ? "#fff" : isExpanded ? "var(--ink)" : "var(--muted)",
                borderColor: hasActiveSub ? "var(--accent)" : isExpanded ? "var(--line-strong)" : "var(--line)",
                fontWeight: isExpanded || hasActiveSub ? 700 : 600,
                gap: "0.3rem",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {sc.emoji} {sc.label}
              <span style={{ fontSize: "0.65rem", marginLeft: "0.1rem", opacity: 0.7 }}>
                {isExpanded ? "▲" : "▼"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expanded subcategories inline */}
      {expandedSuperCat && (
        <div
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

function ExplorePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const categoryParam = searchParams.get("category");
  const requestedCategory = categoryParam ? canonicalizeCategory(categoryParam) : "All";
  const [quizzes, setQuizzes] = useState<QuizWithCreator[]>([]);
  const [searchResults, setSearchResults] = useState<QuizWithCreator[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(
    CATEGORY_LIST.includes(requestedCategory) ? requestedCategory : "All"
  );
  const [sortMode, setSortMode] = useState<SortMode>("popular");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [catalogCursor, setCatalogCursor] = useState<CatalogCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const [surpriseQuiz, setSurpriseQuiz] = useState<QuizWithCreator | null>(null);
  const [surprisePool, setSurprisePool] = useState<QuizWithCreator[]>([]);

  useEffect(() => {
    if (!categoryParam) return;
    const canonical = canonicalizeCategory(categoryParam);
    if (CATEGORY_LIST.includes(canonical)) setActiveCategory(canonical);
    if (canonical !== categoryParam) {
      router.replace(`/explore?category=${encodeURIComponent(canonical)}`);
    }
  }, [categoryParam, router]);

  async function fetchPage(pageIndex: number, append: boolean) {
    if (pageIndex === 0) {
      setLoading(true);
      setFetchError(null);
    } else {
      setLoadingMore(true);
    }

    const cursor = append ? catalogCursor : null;

    let query = supabase
      .from("quizzes")
      .select("*, questions(*, answers(*))")
      .eq("is_public", true)
      .is("archived_at", null);
    let countQuery = supabase
      .from("quizzes")
      .select("id", { count: "exact", head: true })
      .eq("is_public", true)
      .is("archived_at", null);

    if (activeCategory && activeCategory !== "All") {
      const variants = categoryVariants(activeCategory);
      query = query.in("category", variants);
      countQuery = countQuery.in("category", variants);
    }
    if (sortMode === "newest") query = query.order("created_at", { ascending: false });
    else if (sortMode === "az") query = query.order("title", { ascending: true });
    else if (sortMode === "za") query = query.order("title", { ascending: false });
    else query = query.order("plays", { ascending: false });
    query = query.order("id", { ascending: true });

    const cursorFilter = catalogCursorFilter(sortMode, cursor);
    if (cursorFilter) query = query.or(cursorFilter);
    query = query.limit(PAGE_SIZE);

    const [{ data, error }, { count, error: countError }] = await Promise.all([query, countQuery]);

    if (error || countError) {
      console.error("Error fetching quizzes:", error || countError);
      setFetchError("Could not load the quiz catalog. Please try again in a moment.");
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const batch = data ?? [];
    const exactTotal = count ?? batch.length;
    setTotalCount(exactTotal);
    setHasMore((append ? quizzes.length : 0) + batch.length < exactTotal);
    const last = batch[batch.length - 1] as any;
    if (last) setCatalogCursor(catalogCursorForRow(sortMode, last));
    else if (!append) setCatalogCursor(null);

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

      const withCreator = batch.map((q: any) => ({
        ...q,
        creator_name: creatorMap[q.creator_id]?.name ?? undefined,
        creator_display_name: creatorMap[q.creator_id]?.name ?? undefined,
        creator_username: creatorMap[q.creator_id]?.username ?? undefined,
        creator_avatar: creatorMap[q.creator_id]?.avatar ?? undefined,
        creator_level: creatorMap[q.creator_id]?.level ?? undefined,
        creator_level_title: creatorMap[q.creator_id]?.levelTitle ?? undefined,
      })) as QuizWithCreator[];

      setQuizzes((prev) => append ? mergeCatalogPage(prev, withCreator) : withCreator);
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
      }, [activeCategory, sortMode]);

  // When user types a search term, query the full DB — don't just filter the loaded page
  useEffect(() => {
    const term = search.trim();
    if (!term) {
      const hadSearch = searchResults !== null;
      setSearchResults(null);
      if (hadSearch) { setPage(0); void fetchPage(0, false); }
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      let query = supabase
        .from("quizzes")
        .select("*, questions(id)", { count: "exact" })
        .eq("is_public", true)
        .is("archived_at", null)
        .ilike("title", `%${term}%`)
        .order("plays", { ascending: false })
        .limit(50);
      if (activeCategory !== "All") query = query.in("category", categoryVariants(activeCategory));
      const { data, count } = await query;
      if (cancelled) return;
      setTotalCount(count ?? data?.length ?? 0);

      const batch = data ?? [];

      // Fetch creator profiles for search results
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

      const withCreator = batch.map((q: any) => ({
        ...q,
        creator_name: creatorMap[q.creator_id]?.name ?? undefined,
        creator_display_name: creatorMap[q.creator_id]?.name ?? undefined,
        creator_username: creatorMap[q.creator_id]?.username ?? undefined,
        creator_avatar: creatorMap[q.creator_id]?.avatar ?? undefined,
        creator_level: creatorMap[q.creator_id]?.level ?? undefined,
        creator_level_title: creatorMap[q.creator_id]?.levelTitle ?? undefined,
      })) as QuizWithCreator[];

      if (cancelled) return;
      setSearchResults(withCreator);
      setSearchLoading(false);
    }, 300);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [search, activeCategory]);

  function handleLoadMore() {
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
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

  const filtered = useMemo(() => {
    // When searching: use live DB results (full catalog), not just the loaded page
    const base = search.trim() && searchResults !== null ? searchResults : quizzes;

    let result = base.filter((q) => {
      const matchCat = activeCategory === "All" || canonicalizeCategory(q.category) === activeCategory;
      const matchSearch =
        !search.trim() ||
        q.title.toLowerCase().includes(search.toLowerCase()) ||
        (q.category ?? "").toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });

    if (sortMode === "popular") {
      result = [...result].sort((a, b) => b.plays - a.plays);
    } else if (sortMode === "newest") {
      result = [...result].sort((a, b) => {
        const aTime = (a as any).created_at ?? a.createdAt ?? 0;
        const bTime = (b as any).created_at ?? b.createdAt ?? 0;
        const aMs = typeof aTime === "string" ? new Date(aTime).getTime() : aTime;
        const bMs = typeof bTime === "string" ? new Date(bTime).getTime() : bTime;
        return bMs - aMs;
      });
    } else if (sortMode === "az") {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortMode === "za") {
      result = [...result].sort((a, b) => b.title.localeCompare(a.title));
    }

    return result;
  }, [quizzes, searchResults, search, activeCategory, sortMode]);

  // Trending sections derived from all loaded quizzes
  const trendingThisWeek = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = quizzes.filter((q) => {
      const t = (q as any).created_at ?? q.createdAt ?? 0;
      const ms = typeof t === "string" ? new Date(t).getTime() : t;
      return ms >= thirtyDaysAgo;
    });
    const pool = recent.length >= 3 ? recent : quizzes;
    return [...pool].sort((a, b) => b.plays - a.plays).slice(0, 6);
  }, [quizzes]);

  const newAndFresh = useMemo(() => {
    return [...quizzes].sort((a, b) => {
      const aTime = (a as any).created_at ?? a.createdAt ?? 0;
      const bTime = (b as any).created_at ?? b.createdAt ?? 0;
      const aMs = typeof aTime === "string" ? new Date(aTime).getTime() : aTime;
      const bMs = typeof bTime === "string" ? new Date(bTime).getTime() : bTime;
      return bMs - aMs;
    }).slice(0, 6);
  }, [quizzes]);

  const allTimeGreatest = useMemo(() => {
    return [...quizzes].sort((a, b) => b.plays - a.plays).slice(0, 6);
  }, [quizzes]);

  const catalogGridQuizzes = hasActiveFilter
    ? filtered
    : excludeFeaturedQuizzes(filtered, [trendingThisWeek, newAndFresh, allTimeGreatest]);

  const catalogDescription = searchLoading
    ? "Searching across all quizzes…"
    : formatCatalogCount(filtered.length, totalCount, hasActiveFilter ? "result" : "public quiz");

  const showTrendingSections = !hasActiveFilter && !loading && !fetchError && quizzes.length > 0;

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

      <div className="mesh-gradient">
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />
      </div>

      <div className="container explore-container">
        {/* Hero section */}
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

        {/* Search + Sort + Super-category filter */}
        <SectionCard
          title="Search And Filter"
          description="Browse by category or search for a specific topic."
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
                <span className="explore-results-badge">{totalCount} results</span>
              </div>
            </div>

            {/* Super-category selector (replaces flat chip row) */}
            <SuperCategorySelector
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />
          </div>
        </SectionCard>

        {/* Collections section — only when no active filter */}
        {!hasActiveFilter && !loading && (
          <div style={{ marginBottom: "2.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <h2 className="font-display" style={{ fontSize: "1.375rem", fontWeight: 900, color: "var(--ink)" }}>
                  📚 Collections
                </h2>
                <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                  Curated quiz paths for focused learning
                </p>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "1rem",
              }}
            >
              {COLLECTIONS.map((collection) => (
                <CollectionCard
                  key={collection.title}
                  collection={collection}
                  onCategorySelect={(category) => setActiveCategory(category)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Main content area */}
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
            {/* Trending rows — only when no active filter */}
            {showTrendingSections && (
              <>
                <TrendingRow
                  title="🔥 Trending this week"
                  quizzes={trendingThisWeek}
                  onSeeAll={() => setSortMode("popular")}
                />
                <TrendingRow
                  title="✨ New & Fresh"
                  quizzes={newAndFresh}
                  onSeeAll={() => setSortMode("newest")}
                />
                <TrendingRow
                  title="🏆 All-Time Greatest"
                  quizzes={allTimeGreatest}
                  onSeeAll={() => setSortMode("popular")}
                />
              </>
            )}

            {/* Main grid / search results */}
            <SectionCard
              title={hasActiveFilter ? "Search Results" : "All Quizzes"}
              description={catalogDescription}
            >
              <div className="grid-3">
                {catalogGridQuizzes.map((q) => (
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

      {/* Surprise Me floating button */}
      {!loading && quizzes.length > 0 && (
        <button
          onClick={handleSurpriseMe}
          className="btn btn-primary"
          style={{
            position: "fixed",
            bottom: "1.75rem",
            left: "1.75rem",
            zIndex: 1000,
            boxShadow: "0 8px 24px rgba(124,58,237,0.4)",
            gap: "0.4rem",
            display: "flex",
            alignItems: "center",
            whiteSpace: "nowrap",
          }}
          aria-label="Surprise Me — pick a random quiz"
          title="Pick a random quiz"
        >
          🎲 Surprise me
        </button>
      )}

      {/* Inline responsive style for trending rows */}
      <style>{`
        @media (max-width: 767px) {
          .trending-row-scroll {
            display: flex !important;
            overflow-x: auto !important;
            gap: 0.875rem !important;
            padding-bottom: 0.5rem !important;
            scroll-snap-type: x mandatory;
          }
          .trending-row-scroll > * {
            flex: 0 0 280px;
            scroll-snap-align: start;
          }
        }
      `}</style>
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

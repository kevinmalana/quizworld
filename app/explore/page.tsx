"use client";

import Link from "next/link";
import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";

import { CATEGORY_COLORS, CATEGORY_EMOJIS } from "@/lib/store";
import { ExploreQuizCard, type QuizWithCreator } from "@/components/explore/explore-quiz-card";

const CATEGORY_LIST = ["All", ...Object.keys(CATEGORY_COLORS)];

type SortMode = "popular" | "newest" | "az" | "za";

const SORT_OPTIONS: { value: SortMode; label: string; icon: string }[] = [
  { value: "popular", label: "Most Played", icon: "🔥" },
  { value: "newest", label: "Newest", icon: "✨" },
  { value: "az", label: "A → Z", icon: "🔤" },
  { value: "za", label: "Z → A", icon: "🔤" },
];

function getTimeOfDayLabel() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getTimeBasedAccent() {
  const hour = new Date().getHours();
  if (hour < 12) return "linear-gradient(135deg, #f59e0b 0%, #2563eb 100%)";
  if (hour < 17) return "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)";
  return "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)";
}

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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [quickPlayLoading, setQuickPlayLoading] = useState(false);
  const [quickPlayError, setQuickPlayError] = useState<string | null>(null);

  useEffect(() => {
    if (categoryParam && CATEGORY_LIST.includes(categoryParam)) {
      setActiveCategory(categoryParam);
    }
  }, [categoryParam]);

  useEffect(() => {
    async function fetchQuizzes() {
      setLoading(true);
      setFetchError(null);

      const { data, error } = await supabase
        .from("quizzes")
        .select("*, questions(*, answers(*))")
        .eq("is_public", true)
        .is("archived_at", null)
        .order("plays", { ascending: false });

      if (error) {
        console.error("Error fetching quizzes:", error);
        setFetchError("Could not load the quiz catalog. Please try again in a moment.");
      } else if (data && data.length > 0) {
        const creatorIds = [...new Set(data.map((q: any) => q.creator_id).filter(Boolean))];
        let creatorMap: Record<string, string> = {};

        if (creatorIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username")
            .in("id", creatorIds);
          if (profiles) {
            creatorMap = profiles.reduce((acc: Record<string, string>, p: any) => {
              if (p.username) acc[p.id] = p.username;
              return acc;
            }, {});
          }
        }

        const quizzesWithCreator = data.map((q: any) => ({
          ...q,
          creator_name: creatorMap[q.creator_id] ?? undefined,
        }));
        setQuizzes(quizzesWithCreator as QuizWithCreator[]);
      } else {
        setQuizzes([]);
      }
      setLoading(false);
    }

    fetchQuizzes();
  }, []);

  async function handleQuickPlay() {
    if (!user) {
      sessionStorage.setItem("qw_post_login_redirect", "/host");
      router.push("/login");
      return;
    }

    if (quizzes.length === 0) {
      setQuickPlayError("No public quizzes available to play right now.");
      return;
    }

    setQuickPlayLoading(true);
    setQuickPlayError(null);

    try {
      const weights = quizzes.map((q) => Math.max(1, Math.floor(Math.log(q.plays + 1) * 2)));
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let r = Math.floor(Math.random() * totalWeight);
      let quizIndex = 0;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) { quizIndex = i; break; }
      }
      const randomQuiz = quizzes[quizIndex];

      const { data: fullQuiz, error: quizError } = await supabase
        .from("quizzes")
        .select("*, questions(*, answers(*))")
        .eq("id", randomQuiz.id)
        .single();

      if (quizError || !fullQuiz) {
        throw quizError ?? new Error("Could not load the selected quiz.");
      }

      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      if (!authSession?.access_token) {
        throw new Error("Sign in again before hosting a game.");
      }

      const { createPhoenixSession } = await import("@/lib/game-engine/client");

      const questions = [...(fullQuiz.questions ?? [])].sort(
        (l, r) => (l.order_index ?? 0) - (r.order_index ?? 0)
      );

      const response = await createPhoenixSession(
        {
          quiz_id: fullQuiz.id,
          game_mode: "classic",
          questions: questions.map((q: any) => ({
            id: q.id,
            text: q.text,
            time_limit: q.time_limit ?? 20,
            points: q.points ?? 1000,
            order_index: q.order_index ?? 0,
            answers: (q.answers ?? []).map((a: any) => ({
              id: a.id,
              text: a.text,
              is_correct: a.is_correct ?? false,
            })),
          })),
        },
        authSession.access_token
      );

      if (!response?.host_token || !response?.session?.pin) {
        throw new Error("Failed to create the game session.");
      }

      const { writeHostSession } = await import("@/lib/host-session");
      writeHostSession(response.session.pin, {
        hostId: user.id,
        hostToken: response.host_token,
      });

      router.push(`/game/${response.session.pin}`);
    } catch (err) {
      console.error("Quick Play error:", err);
      setQuickPlayError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setQuickPlayLoading(false);
    }
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
        <div className="mesh-blob mesh-blob-1" style={{ opacity: 0.5 }} />
      </div>

      <div className="container explore-container">
        <PageHero
          eyebrow={getTimeOfDayLabel()}
          title="Discover Quizzes"
          description="Search public quiz sets, jump into host mode, or study a topic at your own pace."
          accent={getTimeBasedAccent()}
          actions={
            <div className="explore-hero-actions">
              <button
                onClick={() => void handleQuickPlay()}
                disabled={quickPlayLoading || loading}
                className="btn btn-primary explore-quick-play"
              >
                <span className="explore-quick-play-icon">⚡</span>
                <span>{quickPlayLoading ? "Finding Quiz..." : "Quick Play"}</span>
              </button>
              <Link href="/create" className="btn btn-primary btn-create">
                Create Quiz
              </Link>
              <Link href="/join" className="btn btn-secondary btn-join">
                Join Game
              </Link>
            </div>
          }
        />

        {quickPlayError && (
          <div className="card explore-error-banner">
            {quickPlayError}
            <button onClick={() => setQuickPlayError(null)} className="explore-error-close">✕</button>
          </div>
        )}

        <SectionCard
          title="Search And Filter"
          description="Use category chips and keyword search to narrow the public catalog."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
            <p style={{ fontWeight: 600 }}>Loading quizzes...</p>
          </div>
        ) : fetchError ? (
          <div className="explore-status-panel">
            <div className="explore-status-icon">⚠️</div>
            <h3 className="font-display explore-status-title">Could not load quizzes</h3>
            <p className="explore-status-text">{fetchError}</p>
            <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ marginTop: "1.25rem" }}>
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
                  className="btn btn-secondary"
                  style={{ marginTop: "1.25rem" }}
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
              <Link href="/create" className="btn btn-primary" style={{ marginTop: "1.25rem", display: "inline-flex" }}>
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
      <p style={{ color: "var(--muted)" }}>Loading...</p>
    </div>}>
      <ExplorePageContent />
    </Suspense>
  );
}

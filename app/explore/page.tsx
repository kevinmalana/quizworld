"use client";

import Link from "next/link";
import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";

import { CATEGORY_COLORS, CATEGORY_EMOJIS, type Quiz } from "@/lib/store";

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

type QuizWithCreator = Quiz & { creator_name?: string };

function ShareButton({ quizId, quizTitle }: { quizId: string; quizTitle: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/study/${quizId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleShare}
      title={`Share "${quizTitle}"`}
      style={{
        background: copied ? "var(--success-light)" : "var(--bg)",
        border: `1px solid ${copied ? "var(--success)" : "var(--line)"}`,
        borderRadius: "var(--radius-lg)",
        color: copied ? "var(--success)" : "var(--muted)",
        cursor: "pointer",
        padding: "0.6rem 0.75rem",
        fontSize: "0.875rem",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "✓ Copied" : "Share"}
    </button>
  );
}

function QuizCard({ q }: { q: QuizWithCreator }) {
  const creatorLabel = q.creator_name
    ? `by ${q.creator_name.length > 32 ? q.creator_name.slice(0, 32) + "…" : q.creator_name}`
    : null;

  return (
    <div
      className="card card-hover"
      style={{ display: "flex", flexDirection: "column", padding: "1.5rem", background: "linear-gradient(180deg, var(--surface), var(--bg-subtle))", border: "1px solid var(--line)" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "16px",
            background: `${q.color}15`,
            display: "grid",
            placeItems: "center",
            fontSize: "2rem",
          }}
        >
          {q.emoji || CATEGORY_EMOJIS[q.category] || "📌"}
        </div>
        <span
          className="tag"
          style={{
            background: "var(--bg-subtle)",
            color: "var(--muted)",
            fontSize: "0.75rem",
          }}
        >
          {q.category}
        </span>
      </div>

      <h3
        className="font-display"
        style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--ink)", marginBottom: creatorLabel ? "0.25rem" : "0.5rem", lineHeight: 1.3 }}
      >
        {q.title}
      </h3>
      {creatorLabel && (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.5rem", fontStyle: "italic" }}>
          {creatorLabel}
        </p>
      )}
      <div style={{ display: "flex", gap: "1rem", fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "1.5rem" }}>
        <span>{q.questions?.length || 0} Qs</span>
        <span>▶ {q.plays.toLocaleString()} plays</span>
      </div>

      <div style={{ marginTop: "auto", display: "flex", gap: "0.5rem" }}>
        <Link
          href={`/host?quiz=${q.id}`}
          className="btn btn-primary"
          style={{ flex: 1, padding: "0.6rem 0" }}
        >
          Host
        </Link>
        <Link
          href={`/study/${q.id}`}
          className="btn btn-secondary"
          style={{ padding: "0.6rem 1rem" }}
        >
          Study
        </Link>
        <ShareButton quizId={q.id} quizTitle={q.title} />
      </div>
    </div>
  );
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
        // Fetch creator names from profiles in parallel
        const creatorIds = [...new Set(data.map((q: any) => q.creator_id).filter(Boolean))];
        let creatorMap: Record<string, string> = {};

        if (creatorIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, nickname")
            .in("id", creatorIds);
          if (profiles) {
            creatorMap = profiles.reduce((acc: Record<string, string>, p: any) => {
              if (p.nickname) acc[p.id] = p.nickname;
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

  // ── Quick Play ─────────────────────────────────────────────────────────────
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
      // Pick a random quiz weighted toward more-played ones
      const weights = quizzes.map((q) => Math.max(1, Math.floor(Math.log(q.plays + 1) * 2)));
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let r = Math.floor(Math.random() * totalWeight);
      let quizIndex = 0;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) { quizIndex = i; break; }
      }
      const randomQuiz = quizzes[quizIndex];

      // Load full quiz with questions via Supabase
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

      // Use the Phoenix game engine client (same as host/page.tsx)
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

    // Sort filtered results
    if (sortMode === "popular") {
      result = [...result].sort((a, b) => b.plays - a.plays);
    } else if (sortMode === "newest") {
      // Supabase returns created_at; local store type uses createdAt
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

  // Trending: top 6 by plays, unfiltered by search/category
  const trending = useMemo(() => {
    return [...quizzes]
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 6);
  }, [quizzes]);

  const catalogDescription = hasActiveFilter
    ? `${filtered.length} quiz${filtered.length !== 1 ? "zes" : ""} matching your filters`
    : `All ${filtered.length} public quiz${filtered.length !== 1 ? "zes" : ""}`;

  return (
    <div className="explore-page" style={{ position: "relative", zIndex: 10, paddingBottom: "5rem" }}>
      {/* Background Decor */}
      <div className="mesh-gradient">
        <div className="mesh-blob mesh-blob-1" style={{ opacity: 0.5 }} />
      </div>

      <div className="container" style={{ paddingTop: "3rem" }}>
        <PageHero
          eyebrow={getTimeOfDayLabel()}
          title="Discover Quizzes"
          description="Search public quiz sets, jump into host mode, or study a topic at your own pace."
          accent={getTimeBasedAccent()}
          actions={
            <>
              <button
                onClick={() => void handleQuickPlay()}
                disabled={quickPlayLoading || loading}
                className="btn btn-primary"
                style={{
                  background: quickPlayLoading
                    ? "rgba(255,255,255,0.5)"
                    : "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  cursor: quickPlayLoading || loading ? "not-allowed" : "pointer",
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>⚡</span>
                <span>{quickPlayLoading ? "Finding Quiz..." : "Quick Play"}</span>
              </button>
              <Link href="/create" className="btn btn-primary" style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.22)" }}>
                Create Quiz
              </Link>
              <Link href="/join" className="btn btn-secondary" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", borderColor: "rgba(255,255,255,0.24)" }}>
                Join Game
              </Link>
            </>
          }
        />

        {/* ── Quick Play error ── */}
        {quickPlayError && (
          <div
            className="card"
            style={{
              padding: "0.875rem 1.1rem",
              marginBottom: "1rem",
              border: "1px solid var(--line)",
              background: "var(--primary-light)",
              color: "var(--primary)",
              fontWeight: 600,
              fontSize: "0.9rem",
              borderRadius: "var(--radius-xl)",
            }}
          >
            {quickPlayError}
            <button
              onClick={() => setQuickPlayError(null)}
              style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "var(--primary)", fontWeight: 800, padding: "0 0.25rem" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Search & Filter ── */}
        <SectionCard
          title="Search And Filter"
          description="Use category chips and keyword search to narrow the public catalog."
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Search topics or keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-pin"
                style={{
                  flex: 1,
                  minWidth: 240,
                  textTransform: "none",
                  letterSpacing: "normal",
                  textAlign: "left",
                  fontSize: "1rem",
                  padding: "0.875rem 1rem",
                  border: "1px solid var(--line)",
                  background: "var(--bg)",
                }}
              />

              {/* Sort selector */}
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginRight: "0.25rem" }}>Sort:</span>
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortMode(opt.value)}
                    title={opt.label}
                    style={{
                      padding: "0.45rem 0.75rem",
                      borderRadius: "999px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      border: sortMode === opt.value ? "1px solid transparent" : "1px solid var(--line)",
                      background: sortMode === opt.value ? "linear-gradient(135deg, var(--accent), var(--secondary))" : "var(--surface)",
                      color: sortMode === opt.value ? "#fff" : "var(--muted)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    <span style={{ fontSize: "0.9rem" }}>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0.75rem 1rem",
                  borderRadius: "999px",
                  background: "var(--accent-light)",
                  color: "var(--accent)",
                  fontWeight: 800,
                  fontSize: "0.875rem",
                  whiteSpace: "nowrap",
                }}
              >
                {filtered.length} results
              </div>
            </div>

            <div
              className="hide-scrollbar"
              style={{
                display: "flex",
                gap: "0.5rem",
                overflowX: "auto",
                paddingBottom: "0.5rem",
              }}
            >
              {CATEGORY_LIST.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: "0.6rem 1rem",
                    borderRadius: "999px",
                    fontSize: "0.875rem",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    border: activeCategory === cat ? "1px solid transparent" : "1px solid var(--line)",
                    background: activeCategory === cat ? "linear-gradient(135deg, var(--accent), var(--secondary))" : "var(--surface)",
                    color: activeCategory === cat ? "#fff" : "var(--muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: activeCategory === cat ? "var(--shadow-sm)" : "none",
                  }}
                >
                  {cat === "All" ? "All topics" : `${CATEGORY_EMOJIS[cat] || "📌"} ${cat}`}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* ── Results ── */}
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "5rem 0",
              color: "var(--muted)",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📡</div>
            <p style={{ fontWeight: 600 }}>Loading quizzes...</p>
          </div>
        ) : fetchError ? (
          <div
            style={{
              textAlign: "center",
              padding: "4rem 2rem",
              background: "var(--surface)",
              borderRadius: "var(--radius-xl)",
              border: "1px dashed var(--line-strong)",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
            <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)" }}>
              Could not load quizzes
            </h3>
            <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>{fetchError}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
              style={{ marginTop: "1.25rem" }}
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          hasActiveFilter ? (
            <div
              style={{
                textAlign: "center",
                padding: "4rem 2rem",
                background: "var(--surface)",
                borderRadius: "var(--radius-xl)",
                border: "1px dashed var(--line-strong)",
              }}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔍</div>
              <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)" }}>
                No quizzes match your search
              </h3>
              <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
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
            <div
              style={{
                textAlign: "center",
                padding: "4rem 2rem",
                background: "var(--surface)",
                borderRadius: "var(--radius-xl)",
                border: "1px dashed var(--line-strong)",
              }}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📝</div>
              <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)" }}>
                No public quizzes yet
              </h3>
              <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
                Be the first to create and share a quiz!
              </p>
              <Link href="/create" className="btn btn-primary" style={{ marginTop: "1.25rem", display: "inline-flex" }}>
                Create Quiz
              </Link>
            </div>
          )
        ) : (
          <>
            {/* ── Trending Section (shown when no filter/search is active) ── */}
            {!hasActiveFilter && trending.length >= 3 && (
              <div style={{ marginBottom: "2.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                  <span style={{ fontSize: "1.5rem" }}>🔥</span>
                  <h2 className="font-display" style={{ fontSize: "1.375rem", fontWeight: 900, color: "var(--ink)" }}>
                    Trending Now
                  </h2>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>
                    Most played this week
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
                  {trending.slice(0, 6).map((q) => (
                    <QuizCard key={q.id} q={q} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Full Catalog ── */}
            <SectionCard
              title={hasActiveFilter ? "Search Results" : "All Quizzes"}
              description={catalogDescription}
            >
              <div className="grid-3">
                {filtered.map((q) => (
                  <QuizCard key={q.id} q={q} />
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
    <Suspense fallback={<div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📡</div>
      <p style={{ color: "var(--muted)" }}>Loading...</p>
    </div>}>
      <ExplorePageContent />
    </Suspense>
  );
}

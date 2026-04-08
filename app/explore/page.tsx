"use client";

import Link from "next/link";
import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";

import { CATEGORY_COLORS, CATEGORY_EMOJIS, type Quiz } from "@/lib/store";

const CATEGORY_LIST = ["All", ...Object.keys(CATEGORY_COLORS)];

function ExplorePageContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(
    categoryParam && CATEGORY_LIST.includes(categoryParam) ? categoryParam : "All"
  );
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
      } else if (data) {
        setQuizzes(data as any);
      }
      setLoading(false);
    }

    fetchQuizzes();
  }, []);

  const hasActiveFilter = activeCategory !== "All" || search.trim().length > 0;

  const filtered = useMemo(() => {
    return quizzes.filter((q) => {
      const matchCat = activeCategory === "All" || q.category === activeCategory;
      const matchSearch =
        !search.trim() ||
        q.title.toLowerCase().includes(search.toLowerCase()) ||
        q.category.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [quizzes, search, activeCategory]);

  return (
    <div className="explore-page" style={{ position: "relative", zIndex: 10, paddingBottom: "5rem" }}>
      {/* Background Decor */}
      <div className="mesh-gradient">
        <div className="mesh-blob mesh-blob-1" style={{ opacity: 0.5 }} />
      </div>

      <div className="container" style={{ paddingTop: "3rem" }}>
        <PageHero
          eyebrow="Explore"
          title="Discover Quizzes"
          description="Search public quiz sets, jump into host mode, or study a topic at your own pace."
          accent="linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)"
          actions={
            <>
              <Link href="/create" className="btn btn-primary" style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.22)" }}>
                Create Quiz
              </Link>
              <Link href="/join" className="btn btn-secondary" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", borderColor: "rgba(255,255,255,0.24)" }}>
                Join Game
              </Link>
            </>
          }
        />

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
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
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
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0.75rem 1rem",
                  borderRadius: "999px",
                  background: "var(--accent-light)",
                  color: "var(--accent)",
                  fontWeight: 800,
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
          <SectionCard
            title="Public Catalog"
            description={`Showing ${filtered.length} quiz${filtered.length !== 1 ? "zes" : ""}${hasActiveFilter ? " matching your filters" : ""}.`}
          >
            <div className="grid-3">
              {filtered.map((q) => (
                <div
                  key={q.id}
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
                    style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--ink)", marginBottom: "0.5rem", lineHeight: 1.3 }}
                  >
                    {q.title}
                  </h3>
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
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
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

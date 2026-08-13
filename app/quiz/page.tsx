import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORY_EMOJIS } from "@/lib/shared";

export const metadata: Metadata = {
  title: "Free Online Quizzes — Play Live or Study | QuizWorld",
  description:
    "Browse hundreds of free quizzes on QuizWorld. Play live multiplayer games with friends or study solo. No sign-up needed to play.",
  alternates: { canonical: "https://www.quizworld.xyz/quiz" },
  openGraph: {
    title: "Free Online Quizzes — Play Live or Study | QuizWorld",
    description:
      "Browse hundreds of free quizzes on QuizWorld. Play live multiplayer games with friends or study solo.",
    url: "https://www.quizworld.xyz/quiz",
    type: "website",
  },
};

interface QuizRow {
  id: string;
  slug: string | null;
  title: string;
  category: string;
  plays: number;
  emoji: string | null;
  color: string | null;
  questions: { id: string }[];
}

async function fetchTopQuizzes(): Promise<QuizRow[]> {
  // 2026-08-13: skip fetching if env vars missing (CI build prerender path).
  // Without this guard, fetch() falls back to "undefined/rest/v1/..." which hangs
  // for 60s and crashes the build with "took more than 60 seconds".
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?is_public=eq.true&archived_at=is.null&select=id,slug,title,category,plays,emoji,color,questions(id)&order=plays.desc&limit=12`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return [];
    return (await res.json()) as QuizRow[];
  } catch {
    return [];
  }
}

export default async function QuizLandingPage() {
  const quizzes = await fetchTopQuizzes();

  return (
    <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🧠</div>
        <h1 className="font-display" style={{ fontSize: "2.25rem", marginBottom: "1rem" }}>
          Free Online Quizzes
        </h1>
        <p className="text-muted" style={{ fontSize: "1.1rem", maxWidth: "580px", margin: "0 auto 1.5rem" }}>
          Browse hundreds of free quizzes on QuizWorld. Challenge your friends in a live game or study at your own pace — no sign-up needed to play.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/join" className="btn btn-primary">
            🎮 Join a Live Game
          </Link>
          <Link href="/explore" className="btn btn-secondary">
            🔍 Browse All Quizzes
          </Link>
        </div>
      </div>

      {/* Top quizzes grid */}
      {quizzes.length > 0 && (
        <>
          <h2 className="font-display" style={{ fontSize: "1.4rem", marginBottom: "1.25rem" }}>
            🔥 Most Popular Quizzes
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1.25rem",
              marginBottom: "3rem",
            }}
          >
            {quizzes.map((quiz) => {
              const qCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
              const identifier = quiz.slug || quiz.id;
              const cardEmoji = quiz.emoji || CATEGORY_EMOJIS[quiz.category] || "📌";

              return (
                <div key={quiz.id} className="card card-hover explore-quiz-card">
                  <div className="explore-quiz-card-header">
                    <div
                      className="explore-quiz-emoji"
                      style={{ background: `${quiz.color || "#7c3aed"}15` }}
                    >
                      {cardEmoji}
                    </div>
                    <span className="tag explore-quiz-category">{quiz.category}</span>
                  </div>

                  <h3 className="font-display explore-quiz-title">{quiz.title}</h3>

                  <div className="explore-quiz-meta">
                    <span className="explore-quiz-meta-item">
                      <span className="explore-quiz-meta-icon">📝</span>
                      {qCount} question{qCount !== 1 ? "s" : ""}
                    </span>
                    <span className="explore-quiz-meta-item">
                      <span className="explore-quiz-meta-icon">▶️</span>
                      {quiz.plays.toLocaleString()} plays
                    </span>
                  </div>

                  <div className="explore-quiz-actions">
                    <Link
                      href={`/quiz/${identifier}`}
                      className="btn btn-primary btn-compact"
                    >
                      🎮 Play
                    </Link>
                    <Link
                      href={`/study/${identifier}`}
                      className="btn btn-secondary btn-compact"
                    >
                      📖 Study
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Browse by category */}
      <h2 className="font-display" style={{ fontSize: "1.4rem", marginBottom: "1.25rem" }}>
        Browse by Category
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "0.875rem",
          marginBottom: "3rem",
        }}
      >
        {[
          { name: "General Knowledge", slug: "general-knowledge" },
          { name: "Science & Nature", slug: "science-and-nature" },
          { name: "History", slug: "history" },
          { name: "Technology", slug: "technology" },
          { name: "Sports", slug: "sports" },
          { name: "Music", slug: "music" },
          { name: "Movies", slug: "movies" },
          { name: "Geography", slug: "geography" },
          { name: "Video Games", slug: "video-games" },
          { name: "Food & Drink", slug: "food-and-drink" },
          { name: "Mathematics", slug: "mathematics" },
          { name: "Programming", slug: "programming" },
        ].map((cat) => (
          <Link
            key={cat.slug}
            href={`/explore/${cat.slug}`}
            className="card"
            style={{
              textDecoration: "none",
              textAlign: "center",
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.5rem",
              transition: "transform 0.15s",
            }}
          >
            <span style={{ fontSize: "1.75rem" }}>{CATEGORY_EMOJIS[cat.name] || "📌"}</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{cat.name}</span>
          </Link>
        ))}
      </div>

      {/* More CTA */}
      <div style={{ textAlign: "center" }}>
        <Link href="/explore" className="btn btn-secondary" style={{ marginRight: "1rem" }}>
          View All Quizzes →
        </Link>
        <Link href="/create" className="btn btn-primary">
          ✨ Create a Free Quiz
        </Link>
      </div>
    </div>
  );
}

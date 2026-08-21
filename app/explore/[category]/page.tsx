import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { CATEGORY_EMOJIS } from "@/lib/shared";
import { canonicalizeCategory } from "@/lib/catalog-discovery";

// Slug → display name mapping
const SLUG_TO_CATEGORY: Record<string, string> = {
  "general-knowledge": "General Knowledge",
  "science-and-nature": "Science & Nature",
  "history": "History",
  "technology": "Technology",
  "sports": "Sports",
  "music": "Music",
  "movies": "Movies",
  "geography": "Geography",
  "mathematics": "Mathematics",
  "animals": "Animals",
  "video-games": "Video Games",
  "art-and-literature": "Art & Literature",
  "food-and-drink": "Food & Drink",
  "books": "Books",
  "mythology": "Mythology",
  "programming": "Programming",
  "space-and-astronomy": "Space & Astronomy",
  "tv-shows": "TV Shows",
  "comics-and-anime": "Comics & Anime",
  "travel-and-tourism": "Travel & Tourism",
};

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const mappedCategory = SLUG_TO_CATEGORY[slug];
  const categoryName = mappedCategory ? canonicalizeCategory(mappedCategory) : null;

  if (!categoryName) return { title: "Category Not Found" };

  const supabase = await createClient();
  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id")
    .eq("category", categoryName)
    .eq("is_public", true)
    .is("archived_at", null);

  const count = quizzes?.length ?? 0;
  const title = `Free ${categoryName} Quizzes — Play Online | QuizWorld`;
  const description = `Play ${count} free ${categoryName.toLowerCase()} quizzes on QuizWorld. Test your knowledge with live multiplayer games or study at your own pace.`;
  const canonicalUrl = `https://www.quizworld.xyz/explore/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { category: slug } = await params;
  const mappedCategory = SLUG_TO_CATEGORY[slug];
  const categoryName = mappedCategory ? canonicalizeCategory(mappedCategory) : null;

  if (!categoryName) notFound();

  const supabase = await createClient();
  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, slug, title, category, plays, questions(id), emoji, color")
    .eq("category", categoryName)
    .eq("is_public", true)
    .is("archived_at", null)
    .order("plays", { ascending: false })
    .limit(48);

  const items = quizzes ?? [];
  const emoji = CATEGORY_EMOJIS[categoryName] || "📌";

  return (
    <div className="container explore-container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
      {/* Back link */}
      <Link
        href="/explore"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          marginBottom: "1.5rem",
          textDecoration: "none",
          fontSize: "0.875rem",
          color: "var(--muted)",
        }}
      >
        ← Back to Explore
      </Link>

      {/* Hero */}
      <div
        className="card"
        style={{
          marginBottom: "2rem",
          background: "linear-gradient(135deg, var(--surface) 0%, var(--primary-light) 100%)",
          border: "1px solid var(--line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "3.5rem" }}>{emoji}</span>
          <div style={{ flex: 1 }}>
            <h1
              className="font-display"
              style={{ fontSize: "2rem", margin: "0 0 0.5rem 0" }}
            >
              {categoryName} Quizzes
            </h1>
            <p className="text-muted" style={{ margin: 0 }}>
              {items.length} free quiz{items.length !== 1 ? "zes" : ""} — play live with friends or study solo
            </p>
          </div>
          <Link href="/join" className="btn btn-primary" style={{ flexShrink: 0 }}>
            🎮 Play Live
          </Link>
        </div>
      </div>

      {/* Quiz grid */}
      {items.length === 0 ? (
        <div
          className="explore-status-panel"
          style={{
            textAlign: "center",
            padding: "4rem 2rem",
            background: "var(--surface)",
            borderRadius: "var(--radius-xl)",
            border: "1px dashed var(--line-strong)",
          }}
        >
          <p style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>🔍</p>
          <p className="text-muted">No quizzes in this category yet.</p>
          <Link href="/create" className="btn btn-primary" style={{ marginTop: "1rem" }}>
            Create the first one →
          </Link>
        </div>
      ) : (
        <div
          className="explore-quiz-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {items.map((quiz) => {
            const qCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
            const identifier = (quiz.slug as string | null) || quiz.id;
            const cardEmoji =
              (quiz.emoji as string | null) ||
              CATEGORY_EMOJIS[quiz.category as string] ||
              "📌";
            return (
              <div key={quiz.id} className="card card-hover explore-quiz-card">
                <div className="explore-quiz-card-header">
                  <div
                    className="explore-quiz-emoji"
                    style={{ background: `${(quiz.color as string) || "#7c3aed"}15` }}
                  >
                    {cardEmoji}
                  </div>
                  <span className="tag explore-quiz-category">{quiz.category as string}</span>
                </div>

                <h3 className="font-display explore-quiz-title">{quiz.title as string}</h3>

                <div className="explore-quiz-meta">
                  <span className="explore-quiz-meta-item">
                    <span className="explore-quiz-meta-icon">📝</span>
                    {qCount} question{qCount !== 1 ? "s" : ""}
                  </span>
                  <span className="explore-quiz-meta-item">
                    <span className="explore-quiz-meta-icon">▶️</span>
                    {((quiz.plays as number) ?? 0).toLocaleString()} plays
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
      )}

      {/* Footer CTA */}
      <div
        style={{
          marginTop: "3rem",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <p className="text-muted">Want to add your own {categoryName} quiz?</p>
        <Link href="/create" className="btn btn-primary">
          ✨ Create a Free Quiz
        </Link>
      </div>
    </div>
  );
}

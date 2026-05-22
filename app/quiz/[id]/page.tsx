import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { CATEGORY_EMOJIS } from "@/lib/store";
import { QuizDetailShareButton } from "./QuizDetailShareButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function QuizDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("*, questions(*)")
    .eq("id", id)
    .eq("is_public", true)
    .single();

  if (!quiz) notFound();

  // Fetch creator profile
  const { data: profile } = quiz.creator_id
    ? await supabase
        .from("profiles")
        .select("display_name, avatar_url, level, level_title, username")
        .eq("id", quiz.creator_id)
        .single()
    : { data: null };

  const categoryEmoji =
    quiz.emoji || CATEGORY_EMOJIS[quiz.category as string] || "📌";
  const questions: { id: string; text: string }[] = Array.isArray(quiz.questions)
    ? quiz.questions
    : [];
  const previewQuestions = questions.slice(0, 3);
  const creatorName =
    (profile as { display_name?: string } | null)?.display_name || "Anonymous";
  const creatorAvatar =
    (profile as { avatar_url?: string } | null)?.avatar_url || "👤";
  const creatorLevel = (profile as { level?: number } | null)?.level ?? null;
  const creatorLevelTitle =
    (profile as { level_title?: string } | null)?.level_title ?? null;
  const creatorUsername =
    (profile as { username?: string } | null)?.username ?? null;

  const createdDate = quiz.created_at
    ? new Date(quiz.created_at as string).toLocaleDateString("en-AU", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const quizUrl = `https://quizworld.xyz/quiz/${quiz.id}`;

  return (
    <div className="container quiz-detail-container">
      {/* Back link */}
      <Link
        href="/explore"
        className="text-muted"
        style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", marginBottom: "1.5rem", textDecoration: "none", fontSize: "0.875rem" }}
      >
        ← Back to Explore
      </Link>

      {/* Header card */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          {/* Emoji */}
          <div
            className="explore-quiz-emoji"
            style={{
              background: `${(quiz.color as string) || "#7c3aed"}15`,
              fontSize: "3rem",
              width: 72,
              height: 72,
              borderRadius: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {categoryEmoji}
          </div>

          {/* Title + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
              <span className="tag explore-quiz-category">{quiz.category as string}</span>
            </div>
            <h1 className="font-display" style={{ fontSize: "1.75rem", margin: "0 0 0.5rem 0", lineHeight: 1.2 }}>
              {quiz.title as string}
            </h1>

            {/* Creator */}
            <div className="explore-quiz-creator" style={{ marginTop: "0.5rem" }}>
              <span className="explore-quiz-creator-avatar">{creatorAvatar}</span>
              <div className="explore-quiz-creator-info">
                <span className="explore-quiz-creator-name">
                  {creatorUsername ? (
                    <a href={`/u/${creatorUsername}`} style={{ color: "inherit", textDecoration: "none" }}>
                      {creatorName}
                    </a>
                  ) : (
                    creatorName
                  )}
                  {creatorUsername && (
                    <span className="explore-quiz-creator-handle"> @{creatorUsername}</span>
                  )}
                </span>
                {creatorLevel !== null && (
                  <span className="explore-quiz-creator-level" title={creatorLevelTitle ?? undefined}>
                    ⭐ Lv {creatorLevel}{creatorLevelTitle ? ` · ${creatorLevelTitle}` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Share button (client component) */}
          <QuizDetailShareButton quizUrl={quizUrl} quizTitle={quiz.title as string} />
        </div>

        {/* Stats row */}
        <div className="explore-quiz-meta" style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid var(--line)" }}>
          <span className="explore-quiz-meta-item">
            <span className="explore-quiz-meta-icon">📝</span>
            {questions.length} question{questions.length !== 1 ? "s" : ""}
          </span>
          <span className="explore-quiz-meta-item">
            <span className="explore-quiz-meta-icon">▶️</span>
            {((quiz.plays as number) ?? 0).toLocaleString()} play{(quiz.plays as number) !== 1 ? "s" : ""}
          </span>
          {createdDate && (
            <span className="explore-quiz-meta-item">
              <span className="explore-quiz-meta-icon">📅</span>
              {createdDate}
            </span>
          )}
        </div>

        {/* CTA buttons */}
        <div className="explore-quiz-actions" style={{ marginTop: "1.25rem" }}>
          <Link href={`/join`} className="btn btn-primary">
            ▶ Play Now
          </Link>
          <Link href={`/study/${quiz.id}`} className="btn btn-secondary">
            📖 Study Mode
          </Link>
        </div>
      </div>

      {/* Question preview */}
      {previewQuestions.length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 className="font-display" style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
            Preview ({previewQuestions.length} of {questions.length} questions)
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {previewQuestions.map((q, i) => (
              <div
                key={q.id}
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  alignItems: "flex-start",
                  padding: "0.75rem",
                  background: "var(--surface)",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--line)",
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    color: "var(--accent)",
                    minWidth: 24,
                    fontSize: "0.875rem",
                  }}
                >
                  {i + 1}.
                </span>
                <span style={{ fontSize: "0.9375rem" }}>{q.text}</span>
              </div>
            ))}
          </div>
          {questions.length > 3 && (
            <p className="text-muted" style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
              +{questions.length - 3} more questions — play to find out! 🤫
            </p>
          )}
        </div>
      )}

      {/* Bottom nav */}
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/explore" className="btn btn-secondary">
          ← Back to Explore
        </Link>
        <Link href={`/join`} className="btn btn-primary">
          ▶ Play Now
        </Link>
      </div>
    </div>
  );
}

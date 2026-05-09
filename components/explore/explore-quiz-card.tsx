import Link from "next/link";
import { CATEGORY_EMOJIS, type Quiz } from "@/lib/store";
import { ShareStudyLinkButton } from "@/components/shared/share-study-link-button";

export type QuizWithCreator = Quiz & { creator_name?: string };

export function ExploreQuizCard({ quiz }: { quiz: QuizWithCreator }) {
  const creatorLabel = quiz.creator_name
    ? `by ${quiz.creator_name.length > 32 ? quiz.creator_name.slice(0, 32) + "…" : quiz.creator_name}`
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
            background: `${quiz.color}15`,
            display: "grid",
            placeItems: "center",
            fontSize: "2rem",
          }}
        >
          {quiz.emoji || CATEGORY_EMOJIS[quiz.category] || "📌"}
        </div>
        <span className="tag" style={{ background: "var(--bg-subtle)", color: "var(--muted)", fontSize: "0.75rem" }}>
          {quiz.category}
        </span>
      </div>

      <h3
        className="font-display"
        style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--ink)", marginBottom: creatorLabel ? "0.25rem" : "0.5rem", lineHeight: 1.3 }}
      >
        {quiz.title}
      </h3>
      {creatorLabel && (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.5rem", fontStyle: "italic" }}>
          {creatorLabel}
        </p>
      )}
      <div style={{ display: "flex", gap: "1rem", fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "1.5rem" }}>
        <span>{quiz.questions?.length || 0} Qs</span>
        <span>▶ {quiz.plays.toLocaleString()} plays</span>
      </div>

      <div style={{ marginTop: "auto", display: "flex", gap: "0.5rem" }}>
        <Link href={`/host?quiz=${quiz.id}`} className="btn btn-primary btn-compact" style={{ flex: 1 }}>
          Host
        </Link>
        <Link href={`/study/${quiz.id}`} className="btn btn-secondary btn-compact">
          Study
        </Link>
        <ShareStudyLinkButton quizId={quiz.id} quizTitle={quiz.title} />
      </div>
    </div>
  );
}

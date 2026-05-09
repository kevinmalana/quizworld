import Link from "next/link";
import { CATEGORY_EMOJIS } from "@/lib/store";
import { ShareStudyLinkButton } from "@/components/shared/share-study-link-button";

export type StudyQuizCardQuiz = {
  id: string;
  title: string;
  emoji: string | null;
  color: string | null;
  category: string;
  questions?: { count: number }[];
};

export type StudyQuizProgress = {
  mastery: number;
  last_studied: string;
};

function StudyQuizIcon({ quiz }: { quiz: StudyQuizCardQuiz }) {
  return (
    <div style={{ width: 48, height: 48, borderRadius: 12, background: `${quiz.color ?? "var(--accent)"}15`, display: "grid", placeItems: "center", fontSize: "1.5rem", flexShrink: 0 }}>
      {quiz.emoji || CATEGORY_EMOJIS[quiz.category] || "📝"}
    </div>
  );
}

export function AvailableStudyQuizCard({ quiz }: { quiz: StudyQuizCardQuiz }) {
  const questionCount = quiz.questions?.[0]?.count ?? 0;

  return (
    <Link
      href={`/study/${quiz.id}`}
      className="card card-hover"
      style={{ padding: "1.5rem", display: "block", textDecoration: "none", border: "2px solid var(--line)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <StudyQuizIcon quiz={quiz} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: "var(--ink)" }}>{quiz.title}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{questionCount} questions · {quiz.category}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
        <button className="btn btn-primary" style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem" }}>
          Study Now
        </button>
        <ShareStudyLinkButton quizId={quiz.id} quizTitle={quiz.title} compact />
      </div>
    </Link>
  );
}

export function ContinueStudyQuizCard({ quiz, progress }: { quiz: StudyQuizCardQuiz; progress?: StudyQuizProgress }) {
  const questionCount = quiz.questions?.[0]?.count ?? 0;
  const mastery = progress?.mastery ?? 0;
  const masteryColor = mastery >= 80 ? "var(--success)" : mastery >= 50 ? "#eab308" : "var(--primary)";

  return (
    <Link
      href={`/study/${quiz.id}`}
      className="card card-hover"
      style={{ padding: "1.5rem", display: "block", textDecoration: "none", border: "2px solid var(--line)", position: "relative", overflow: "hidden" }}
    >
      {progress && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${mastery}%`,
            background: `${masteryColor}10`,
            borderRight: `2px solid ${masteryColor}`,
            transition: "width 0.3s ease",
          }}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem", position: "relative" }}>
        <StudyQuizIcon quiz={quiz} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {quiz.title}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{questionCount} Qs · {quiz.category}</div>
        </div>
        {progress && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontWeight: 900, fontSize: "1.1rem", color: masteryColor }}>{mastery}%</div>
            <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>mastery</div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: "0.5rem", position: "relative" }}>
        <button className="btn btn-primary" style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem" }}>
          Resume
        </button>
        <Link href={`/study/${quiz.id}`} className="btn btn-secondary" style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem" }} onClick={(e) => e.stopPropagation()}>
          Study Again
        </Link>
        <ShareStudyLinkButton quizId={quiz.id} quizTitle={quiz.title} compact />
      </div>
      {progress?.last_studied && (
        <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.5rem", textAlign: "right", position: "relative" }}>
          Last studied {new Date(progress.last_studied).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
      )}
    </Link>
  );
}

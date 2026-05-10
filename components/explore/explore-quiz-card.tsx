import Link from "next/link";
import { CATEGORY_EMOJIS, type Quiz } from "@/lib/store";
import { ShareStudyLinkButton } from "@/components/shared/share-study-link-button";

export type QuizWithCreator = Quiz & {
  creator_name?: string;
  creator_display_name?: string;
  creator_username?: string;
  creator_avatar?: string;
};

export function ExploreQuizCard({ quiz }: { quiz: QuizWithCreator }) {
  const displayName = quiz.creator_display_name || quiz.creator_name || null;
  const username = quiz.creator_username || null;
  const avatar = quiz.creator_avatar || "👤";

  return (
    <div className="card card-hover explore-quiz-card">
      <div className="explore-quiz-card-header">
        <div className="explore-quiz-emoji" style={{ background: `${quiz.color || "#7c3aed"}15` }}>
          {quiz.emoji || CATEGORY_EMOJIS[quiz.category] || "📌"}
        </div>
        <span className="tag explore-quiz-category">{quiz.category}</span>
      </div>

      <h3 className="font-display explore-quiz-title">{quiz.title}</h3>

      <div className="explore-quiz-creator">
        <span className="explore-quiz-creator-avatar">{avatar}</span>
        <span className="explore-quiz-creator-name">
          {displayName || "Anonymous"}
          {username && <span className="explore-quiz-creator-handle"> @{username}</span>}
        </span>
      </div>

      <div className="explore-quiz-meta">
        <span className="explore-quiz-meta-item">
          <span className="explore-quiz-meta-icon">📝</span>
          {quiz.questions?.length || 0} questions
        </span>
        <span className="explore-quiz-meta-item">
          <span className="explore-quiz-meta-icon">▶️</span>
          {quiz.plays.toLocaleString()} plays
        </span>
      </div>

      <div className="explore-quiz-actions">
        <Link href={`/host?quiz=${quiz.id}`} className="btn btn-primary btn-compact explore-quiz-action-host">
          🏁 Host
        </Link>
        <Link href={`/study/${quiz.id}`} className="btn btn-secondary btn-compact">
          📖 Study
        </Link>
        <ShareStudyLinkButton quizId={quiz.id} quizTitle={quiz.title} />
      </div>
    </div>
  );
}

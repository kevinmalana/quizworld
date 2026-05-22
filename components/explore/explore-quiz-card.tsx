"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORY_EMOJIS, type Quiz } from "@/lib/store";
import { ShareStudyLinkButton } from "@/components/shared/share-study-link-button";
import { HostIcon } from "@/components/shared/host-icon";

export type QuizWithCreator = Quiz & {
  creator_name?: string;
  creator_display_name?: string;
  creator_username?: string;
  creator_avatar?: string;
  creator_level?: number;
  creator_level_title?: string;
};

export function ExploreQuizCard({ quiz }: { quiz: QuizWithCreator }) {
  const displayName = quiz.creator_display_name || quiz.creator_name || null;
  const username = quiz.creator_username || null;
  const avatar = quiz.creator_avatar || "👤";
  const level = quiz.creator_level ?? null;
  const levelTitle = quiz.creator_level_title ?? null;
  const [shareCopied, setShareCopied] = useState(false);

  function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    const text = `Check out "${quiz.title}" on QuizWorld! quizworld.xyz/quiz/${quiz.id}`;
    navigator.clipboard.writeText(text).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }).catch(() => {});
  }

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
        <div className="explore-quiz-creator-info">
          <span className="explore-quiz-creator-name">
            {username ? (
              <a href={`/u/${username}`} style={{ color: "inherit", textDecoration: "none" }}>
                {displayName || "Anonymous"}
              </a>
            ) : (displayName || "Anonymous")}
            {username && <span className="explore-quiz-creator-handle"> @{username}</span>}
          </span>
          {level !== null && (
            <span className="explore-quiz-creator-level" title={levelTitle ?? undefined}>
              ⭐ Lv {level}{levelTitle ? ` · ${levelTitle}` : ""}
            </span>
          )}
        </div>
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
          <HostIcon size={14} /> Host
        </Link>
        <Link href={`/study/${quiz.id}`} className="btn btn-secondary btn-compact">
          📖 Study
        </Link>
        <ShareStudyLinkButton quizId={quiz.id} quizTitle={quiz.title} />
        <button
          onClick={handleShare}
          className="btn btn-secondary btn-compact"
          title="Share quiz link"
        >
          {shareCopied ? "✅" : "📤"}
        </button>
      </div>
      <div style={{ marginTop: "0.5rem", textAlign: "center" }}>
        <Link
          href={`/quiz/${quiz.id}`}
          style={{ fontSize: "0.8rem", color: "var(--muted)", textDecoration: "none" }}
        >
          View details →
        </Link>
      </div>
    </div>
  );
}

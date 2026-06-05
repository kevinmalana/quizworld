import Link from "next/link";
import { CATEGORY_EMOJIS } from "@/lib/store";

export type StudyQuizCardQuiz = {
  id: string;
  title: string;
  emoji: string | null;
  color: string | null;
  category: string;
  questions?: { id: string }[];
};

export type StudyQuizProgress = {
  mastery: number;
  last_studied: string;
};

function StudyQuizIcon({ quiz }: { quiz: StudyQuizCardQuiz }) {
  return (
    <div className="study-quiz-icon" style={{ background: `${quiz.color ?? "var(--accent)"}15` }}>
      {quiz.emoji || CATEGORY_EMOJIS[quiz.category] || "📝"}
    </div>
  );
}

export function AvailableStudyQuizCard({ quiz }: { quiz: StudyQuizCardQuiz }) {
  const questionCount = quiz.questions?.length ?? 0;

  return (
    <Link
      href={`/study/${quiz.id}`}
      className="card card-hover study-quiz-card"
    >
      <div className="study-quiz-card__header">
        <StudyQuizIcon quiz={quiz} />
        <div className="study-quiz-card__body">
          <div className="study-quiz-card__title">{quiz.title}</div>
          <div className="study-quiz-card__meta">{questionCount} questions · {quiz.category}</div>
        </div>
      </div>
      <div className="study-quiz-card__actions">
        <button className="btn btn-primary study-quiz-card__button">
          Study Now
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            const url = `https://www.quizworld.xyz/quiz/${quiz.id}`;
            const shareData = { title: quiz.title, text: `Check out "${quiz.title}" on QuizWorld!`, url };
            if (typeof navigator.share === "function" && navigator.canShare?.(shareData)) {
              navigator.share(shareData).catch(() => {});
            } else {
              navigator.clipboard.writeText(url).catch(() => {});
            }
          }}
          className="btn btn-secondary btn-compact"
          title="Share quiz"
        >
          📤 Share
        </button>
      </div>
    </Link>
  );
}

export function ContinueStudyQuizCard({ quiz, progress }: { quiz: StudyQuizCardQuiz; progress?: StudyQuizProgress }) {
  const questionCount = quiz.questions?.length ?? 0;
  const mastery = progress?.mastery ?? 0;
  const masteryColor = mastery >= 80 ? "var(--success)" : mastery >= 50 ? "#eab308" : "var(--primary)";

  return (
    <Link
      href={`/study/${quiz.id}`}
      className="card card-hover study-quiz-card study-quiz-card--progress"
    >
      {progress && (
        <div
          className="study-quiz-card__progress-bg"
          style={{
            width: `${mastery}%`,
            background: `${masteryColor}10`,
            borderRight: `2px solid ${masteryColor}`,
          }}
        />
      )}
      <div className="study-quiz-card__header study-quiz-card__layer">
        <StudyQuizIcon quiz={quiz} />
        <div className="study-quiz-card__body">
          <div className="study-quiz-card__title study-quiz-card__title--truncate">
            {quiz.title}
          </div>
          <div className="study-quiz-card__meta">{questionCount} Qs · {quiz.category}</div>
        </div>
        {progress && (
          <div className="study-quiz-card__mastery">
            <div className="study-quiz-card__mastery-value" style={{ color: masteryColor }}>{mastery}%</div>
            <div className="study-quiz-card__mastery-label">mastery</div>
          </div>
        )}
      </div>
      <div className="study-quiz-card__actions study-quiz-card__layer">
        <button className="btn btn-primary study-quiz-card__button">
          Resume
        </button>
        <Link href={`/study/${quiz.id}`} className="btn btn-secondary study-quiz-card__button" onClick={(e) => e.stopPropagation()}>
          Study Again
        </Link>
        <button
          onClick={(e) => {
            e.preventDefault();
            const url = `https://www.quizworld.xyz/quiz/${quiz.id}`;
            const shareData = { title: quiz.title, text: `Check out "${quiz.title}" on QuizWorld!`, url };
            if (typeof navigator.share === "function" && navigator.canShare?.(shareData)) {
              navigator.share(shareData).catch(() => {});
            } else {
              navigator.clipboard.writeText(url).catch(() => {});
            }
          }}
          className="btn btn-secondary btn-compact"
          title="Share quiz"
        >
          📤 Share
        </button>
      </div>
      {progress?.last_studied && (
        <div className="study-quiz-card__last-studied">
          Last studied {new Date(progress.last_studied).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
      )}
    </Link>
  );
}

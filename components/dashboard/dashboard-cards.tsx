import Link from "next/link";
import type { GameResultRow } from "@/lib/reporting/game-results";
import { getBestHostedScore } from "@/lib/reporting/game-results";
import type { QuizDraftRow, QuizVersionRow } from "@/lib/quiz-drafts";

export type DashboardQuizRow = {
  id: string;
  title: string;
  emoji: string | null;
  color: string | null;
  plays: number | null;
  is_public: boolean;
  archived_at: string | null;
  questions?: { count: number }[];
};

export function DashboardNotice({ message, tone }: { message: string; tone: "success" | "primary" }) {
  if (!message) return null;
  return (
    <div className={`card dashboard-notice dashboard-notice--${tone}`}>
      <strong>{message}</strong>
    </div>
  );
}

export function DashboardMetricGrid({ children }: { children: React.ReactNode }) {
  return <div className="dashboard-metric-grid">{children}</div>;
}

export function DraftCard({ draft }: { draft: QuizDraftRow }) {
  return (
    <div className="card dashboard-card">
      <div className="dashboard-card-header">
        <div className="dashboard-card-icon dashboard-card-icon--draft" style={{ background: `${draft.color ?? "var(--accent)"}15` }}>{draft.emoji || "📝"}</div>
        <div className="dashboard-card-body">
          <div className="dashboard-card-title dashboard-card-title--truncate">{draft.title || "Untitled Draft"}</div>
          <div className="dashboard-card-meta">{draft.source_type.replace("-", " ")} • {new Date(draft.updated_at).toLocaleString()}</div>
        </div>
      </div>
      <div className="dashboard-action-row">
        <Link href={`/create?draft=${draft.id}`} className="btn btn-primary btn-compact dashboard-action">Continue</Link>
        {draft.quiz_id ? (
          <Link href={`/host?quiz=${draft.quiz_id}`} className="btn btn-secondary btn-compact dashboard-action">Host Live</Link>
        ) : (
          <div className="btn btn-secondary btn-compact dashboard-action dashboard-action--disabled">Unpublished</div>
        )}
      </div>
    </div>
  );
}

export function VersionCard({ version, actioningVersionId, onRestore }: { version: QuizVersionRow; actioningVersionId: string | null; onRestore: (version: QuizVersionRow) => void }) {
  return (
    <div className="card dashboard-card dashboard-card--version">
      <div className="dashboard-version-row">
        <div>
          <div className="font-display dashboard-version-title">{version.title} <span>v{version.version_number}</span></div>
          <div className="dashboard-card-meta">{version.category} • {new Date(version.created_at).toLocaleString()}</div>
        </div>
        <div className="dashboard-version-actions">
          <button onClick={() => onRestore(version)} disabled={actioningVersionId === version.id} className="btn btn-primary btn-compact">{actioningVersionId === version.id ? "Restoring..." : "Restore As Draft"}</button>
          <Link href={`/create?version=${version.id}`} className="btn btn-secondary btn-compact">Open Snapshot</Link>
          <Link href={`/create?quiz=${version.quiz_id}`} className="btn btn-primary btn-compact">Edit Current</Link>
        </div>
      </div>
    </div>
  );
}

export function PublishedQuizCard({ quiz, actioningQuizId, onArchive, onVisibility }: { quiz: DashboardQuizRow; actioningQuizId: string | null; onArchive: (quizId: string, archived: boolean) => void; onVisibility: (quizId: string, isPublic: boolean) => void }) {
  return (
    <div className="card card-hover dashboard-card dashboard-card--published">
      <QuizCardHeader quiz={quiz} />
      <div className="dashboard-action-grid dashboard-action-grid--two">
        <Link href={`/host?quiz=${quiz.id}`} className="btn btn-primary btn-compact dashboard-action">Host</Link>
        <Link href={`/create?quiz=${quiz.id}`} className="btn btn-secondary btn-compact dashboard-action">Edit</Link>
      </div>
      <div className="dashboard-action-grid dashboard-action-grid--three">
        <Link href={`/create?quiz=${quiz.id}&duplicate=1`} className="btn btn-secondary btn-compact dashboard-action">Duplicate</Link>
        <Link href={`/study/${quiz.id}`} className="btn btn-secondary btn-compact dashboard-action">Study</Link>
        <button onClick={() => onVisibility(quiz.id, !quiz.is_public)} disabled={actioningQuizId === quiz.id} className="btn btn-secondary btn-compact dashboard-action">{actioningQuizId === quiz.id ? "..." : quiz.is_public ? "Make Private" : "Make Public"}</button>
      </div>
      <div className="dashboard-action-grid dashboard-action-grid--archive">
        <button onClick={() => onArchive(quiz.id, true)} disabled={actioningQuizId === quiz.id} className="btn btn-secondary btn-compact dashboard-action">{actioningQuizId === quiz.id ? "..." : "Archive"}</button>
      </div>
    </div>
  );
}

export function ArchivedQuizCard({ quiz, actioningQuizId, onArchive }: { quiz: DashboardQuizRow; actioningQuizId: string | null; onArchive: (quizId: string, archived: boolean) => void }) {
  return (
    <div className="card dashboard-card dashboard-card--archived">
      <div className="dashboard-card-header">
        <div className="dashboard-card-icon dashboard-card-icon--archived" style={{ background: `${quiz.color}12` }}>{quiz.emoji || "📝"}</div>
        <div className="dashboard-card-body">
          <div className="dashboard-card-title">{quiz.title}</div>
          <div className="dashboard-card-meta">Archived {quiz.archived_at ? new Date(quiz.archived_at).toLocaleString() : ""}</div>
        </div>
      </div>
      <div className="dashboard-action-grid dashboard-action-grid--two">
        <Link href={`/create?quiz=${quiz.id}&duplicate=1`} className="btn btn-secondary btn-compact">Duplicate</Link>
        <button onClick={() => onArchive(quiz.id, false)} disabled={actioningQuizId === quiz.id} className="btn btn-primary btn-compact">{actioningQuizId === quiz.id ? "..." : "Restore"}</button>
      </div>
    </div>
  );
}

function QuizCardHeader({ quiz }: { quiz: DashboardQuizRow }) {
  const qCount = quiz.questions?.[0]?.count ?? 0;
  return (
    <div className="dashboard-card-header">
      <div className="dashboard-card-icon" style={{ background: `${quiz.color}15` }}>{quiz.emoji || "📝"}</div>
      <div className="dashboard-card-body">
        <div className="dashboard-card-title">{quiz.title}</div>
        <div className="dashboard-card-meta">
          {qCount === 0
            ? <span style={{ color: "var(--warning, #f59e0b)", fontWeight: 700 }}>⚠️ No questions — add some before hosting</span>
            : <>{qCount} question{qCount !== 1 ? "s" : ""} · {(quiz.plays ?? 0).toLocaleString()} plays</>}
        </div>
      </div>
      <div className={quiz.is_public ? "dashboard-visibility-pill is-public" : "dashboard-visibility-pill"}>{quiz.is_public ? "Public" : "Private"}</div>
    </div>
  );
}

export function RecentGameCard({ game }: { game: GameResultRow }) {
  return (
    <div className="card dashboard-recent-game">
      <div>
        <div className="dashboard-recent-game__pin">PIN {game.pin}</div>
        <div className="dashboard-card-meta">{game.player_count ?? 0} players • {new Date(game.finished_at).toLocaleString()}</div>
      </div>
      <div className="dashboard-recent-game__actions">
        <span>{getBestHostedScore([game]).toLocaleString()} top</span>
        <Link href={`/report/${game.pin}`} className="btn btn-secondary btn-compact">📊 Report</Link>
      </div>
    </div>
  );
}

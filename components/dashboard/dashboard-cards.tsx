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
    <div className="card" style={{ padding: "1rem 1.25rem", marginBottom: "1.5rem", border: "1px solid var(--line)", background: `var(--${tone}-light)` }}>
      <strong style={{ color: `var(--${tone})` }}>{message}</strong>
    </div>
  );
}

export function DashboardMetricGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>{children}</div>;
}

export function DraftCard({ draft }: { draft: QuizDraftRow }) {
  return (
    <div className="card" style={{ padding: "1.5rem", border: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `${draft.color ?? "var(--accent)"}15`, display: "grid", placeItems: "center", fontSize: "1.5rem" }}>{draft.emoji || "📝"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{draft.title || "Untitled Draft"}</div>
          <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>{draft.source_type.replace("-", " ")} • {new Date(draft.updated_at).toLocaleString()}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Link href={`/create?draft=${draft.id}`} className="btn btn-primary btn-compact" style={{ flex: 1 }}>Continue</Link>
        {draft.quiz_id ? (
          <Link href={`/host?quiz=${draft.quiz_id}`} className="btn btn-secondary btn-compact" style={{ flex: 1 }}>Host Live</Link>
        ) : (
          <div className="btn btn-secondary btn-compact" style={{ flex: 1, opacity: 0.45, pointerEvents: "none" }}>Unpublished</div>
        )}
      </div>
    </div>
  );
}

export function VersionCard({ version, actioningVersionId, onRestore }: { version: QuizVersionRow; actioningVersionId: string | null; onRestore: (version: QuizVersionRow) => void }) {
  return (
    <div className="card" style={{ padding: "1rem 1.1rem", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)", background: "linear-gradient(180deg, var(--surface), var(--bg-subtle))" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div className="font-display" style={{ fontSize: "1rem", fontWeight: 800, color: "var(--ink)" }}>{version.title} <span style={{ color: "var(--accent)" }}>v{version.version_number}</span></div>
          <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>{version.category} • {new Date(version.created_at).toLocaleString()}</div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
    <div className="card card-hover" style={{ padding: "1.5rem", border: "1px solid var(--line)", background: "linear-gradient(180deg, var(--surface), var(--bg-subtle))" }}>
      <QuizCardHeader quiz={quiz} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <Link href={`/host?quiz=${quiz.id}`} className="btn btn-primary btn-compact" style={{ flex: 1 }}>Host</Link>
        <Link href={`/create?quiz=${quiz.id}`} className="btn btn-secondary btn-compact" style={{ flex: 1 }}>Edit</Link>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.5rem" }}>
        <Link href={`/create?quiz=${quiz.id}&duplicate=1`} className="btn btn-secondary btn-compact" style={{ flex: 1 }}>Duplicate</Link>
        <Link href={`/study/${quiz.id}`} className="btn btn-secondary btn-compact" style={{ flex: 1 }}>Study</Link>
        <button onClick={() => onVisibility(quiz.id, !quiz.is_public)} disabled={actioningQuizId === quiz.id} className="btn btn-secondary btn-compact" style={{ flex: 1 }}>{actioningQuizId === quiz.id ? "..." : quiz.is_public ? "Make Private" : "Make Public"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button onClick={() => onArchive(quiz.id, true)} disabled={actioningQuizId === quiz.id} className="btn btn-secondary btn-compact" style={{ flex: 1 }}>{actioningQuizId === quiz.id ? "..." : "Archive"}</button>
      </div>
    </div>
  );
}

export function ArchivedQuizCard({ quiz, actioningQuizId, onArchive }: { quiz: DashboardQuizRow; actioningQuizId: string | null; onArchive: (quizId: string, archived: boolean) => void }) {
  return (
    <div className="card" style={{ padding: "1.5rem", border: "1px dashed var(--line-strong)", background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: `${quiz.color}12`, display: "grid", placeItems: "center", fontSize: "1.5rem", opacity: 0.7 }}>{quiz.emoji || "📝"}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, color: "var(--ink)" }}>{quiz.title}</div>
          <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Archived {quiz.archived_at ? new Date(quiz.archived_at).toLocaleString() : ""}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
        <Link href={`/create?quiz=${quiz.id}&duplicate=1`} className="btn btn-secondary btn-compact">Duplicate</Link>
        <button onClick={() => onArchive(quiz.id, false)} disabled={actioningQuizId === quiz.id} className="btn btn-primary btn-compact">{actioningQuizId === quiz.id ? "..." : "Restore"}</button>
      </div>
    </div>
  );
}

function QuizCardHeader({ quiz }: { quiz: DashboardQuizRow }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: `${quiz.color}15`, display: "grid", placeItems: "center", fontSize: "1.5rem" }}>{quiz.emoji || "📝"}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, color: "var(--ink)" }}>{quiz.title}</div>
        <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>{quiz.questions?.[0]?.count ?? 0} questions · {(quiz.plays ?? 0).toLocaleString()} plays</div>
      </div>
      <div style={{ padding: "0.45rem 0.75rem", borderRadius: "999px", background: quiz.is_public ? "var(--success-light)" : "var(--warning-light)", color: quiz.is_public ? "var(--success)" : "var(--warning)", fontSize: "0.75rem", fontWeight: 800, whiteSpace: "nowrap" }}>{quiz.is_public ? "Public" : "Private"}</div>
    </div>
  );
}

export function RecentGameCard({ game }: { game: GameResultRow }) {
  return (
    <div className="card" style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
      <div>
        <div style={{ fontWeight: 700 }}>PIN {game.pin}</div>
        <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>{game.player_count ?? 0} players • {new Date(game.finished_at).toLocaleString()}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ color: "var(--muted)", fontWeight: 700, fontSize: "0.875rem" }}>{getBestHostedScore([game]).toLocaleString()} top</span>
        <Link href={`/report/${game.pin}`} className="btn btn-secondary btn-compact">📊 Report</Link>
      </div>
    </div>
  );
}

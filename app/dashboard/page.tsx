"use client";

import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import {
  type GameResultRow,
  getBestHostedScore,
  getHostedGameCount,
  getRecentHostedResults,
  getTotalHostedPlayers,
} from "@/lib/reporting/game-results";
import {
  questionsFromVersionSnapshot,
  type QuizDraftRow,
  type QuizVersionRow,
} from "@/lib/quiz-drafts";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";

type QuizRow = {
  id: string;
  title: string;
  emoji: string | null;
  color: string | null;
  plays: number | null;
  is_public: boolean;
  archived_at: string | null;
  questions?: { count: number }[];
};

function MetricCard({
  label,
  value,
  tone = "var(--accent)",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div
      className="card"
      style={{
        padding: "1.25rem",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-sm)",
        background: "linear-gradient(180deg, var(--surface), var(--bg-subtle))",
      }}
    >
      <div style={{ fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.65rem" }}>
        {label}
      </div>
      <div className="font-display" style={{ fontSize: "2rem", fontWeight: 900, color: tone }}>
        {value}
      </div>
    </div>
  );
}

function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [drafts, setDrafts] = useState<QuizDraftRow[]>([]);
  const [versions, setVersions] = useState<QuizVersionRow[]>([]);
  const [gameResults, setGameResults] = useState<GameResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningQuizId, setActioningQuizId] = useState<string | null>(null);
  const [actioningDraftId, setActioningDraftId] = useState<string | null>(null);
  const [actioningVersionId, setActioningVersionId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const createdQuizId = searchParams.get("created");
  const updatedQuizId = searchParams.get("updated");
  const updatedVersion = searchParams.get("version");

  useEffect(() => {
    if (!user) {
      setQuizzes([]);
      setLoading(false);
      return;
    }

    let ignore = false;
    const userId = user.id;

    async function fetchQuizzes() {
      const [
        { data, error },
        { data: draftRows, error: draftError },
        { data: versionRows, error: versionError },
        { data: resultRows, error: resultError },
      ] =
        await Promise.all([
          supabase
            .from("quizzes")
            .select("id, title, emoji, color, plays, is_public, archived_at, questions(count)")
            .eq("creator_id", userId)
            .order("created_at", { ascending: false }),
          supabase
            .from("quiz_drafts")
            .select("id, quiz_id, title, category, emoji, color, is_public, source_type, updated_at")
            .eq("owner_id", userId)
            .order("updated_at", { ascending: false })
            .limit(6),
          supabase
            .from("quiz_versions")
            .select("id, quiz_id, creator_id, version_number, title, category, emoji, color, is_public, snapshot, created_at")
            .eq("creator_id", userId)
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("game_results")
            .select("id, pin, quiz_id, host_id, player_count, finished_at, results")
            .eq("host_id", userId)
            .order("finished_at", { ascending: false })
            .limit(20),
        ]);

      if (ignore) return;

      if (error) {
        console.error("Error fetching dashboard quizzes:", error);
        setQuizzes([]);
      } else {
        setQuizzes((data as QuizRow[]) ?? []);
      }
      if (draftError) {
        console.error("Error fetching quiz drafts:", draftError);
        setDrafts([]);
      } else {
        setDrafts((draftRows as QuizDraftRow[]) ?? []);
      }
      if (versionError) {
        console.error("Error fetching quiz versions:", versionError);
        setVersions([]);
      } else {
        setVersions((versionRows as QuizVersionRow[]) ?? []);
      }
      if (resultError) {
        console.error("Error fetching hosted game results:", resultError);
        setGameResults([]);
      } else {
        setGameResults((resultRows as GameResultRow[]) ?? []);
      }
      setLoading(false);
    }

    fetchQuizzes();
    return () => {
      ignore = true;
    };
  }, [user]);

  if (authLoading || loading) {
    return <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>Loading...</div>;
  }

  if (!user) {
    return (
      <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>
        <div className="card" style={{ padding: "3rem", maxWidth: 420, margin: "0 auto" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔐</div>
          <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>
            Sign In Required
          </h2>
          <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
            Sign in to manage the quizzes attached to your account.
          </p>
          <Link href="/login" className="btn btn-primary">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const hostedGames = getHostedGameCount(gameResults);
  const hostedPlayers = getTotalHostedPlayers(gameResults);
  const recentGames = getRecentHostedResults(gameResults, 4);
  const activeQuizzes = quizzes.filter((quiz) => !quiz.archived_at);
  const archivedQuizzes = quizzes.filter((quiz) => Boolean(quiz.archived_at));
  const totalQuizPlays = activeQuizzes.reduce((sum, quiz) => sum + (quiz.plays ?? 0), 0);

  async function updateArchiveState(quizId: string, archived: boolean) {
    if (!user) return;

    setActioningQuizId(quizId);
    setActionError("");
    setActionNotice("");
    const timestamp = archived ? new Date().toISOString() : null;
    const userId = user.id;

    const { error } = await supabase
      .from("quizzes")
      .update({ archived_at: timestamp })
      .eq("id", quizId)
      .eq("creator_id", userId);

    if (error) {
      console.error("Error updating archive state:", error);
      setActioningQuizId(null);
      return;
    }

    setQuizzes((current) =>
      current.map((quiz) =>
        quiz.id === quizId ? { ...quiz, archived_at: timestamp } : quiz
      )
    );
    setActionNotice(archived ? "Quiz archived." : "Quiz restored.");
    setActioningQuizId(null);
  }

  async function updateVisibility(quizId: string, isPublic: boolean) {
    if (!user) return;

    setActioningQuizId(quizId);
    setActionError("");
    setActionNotice("");

    const { error } = await supabase
      .from("quizzes")
      .update({ is_public: isPublic })
      .eq("id", quizId)
      .eq("creator_id", user.id);

    if (error) {
      console.error("Error updating quiz visibility:", error);
      setActionError("Could not update quiz visibility.");
      setActioningQuizId(null);
      return;
    }

    setQuizzes((current) =>
      current.map((quiz) => (quiz.id === quizId ? { ...quiz, is_public: isPublic } : quiz))
    );
    setActionNotice(isPublic ? "Quiz is now public." : "Quiz is now private.");
    setActioningQuizId(null);
  }

  async function deleteDraft(draftId: string) {
    if (!user) return;
    const confirmed = window.confirm(
      "Delete this saved draft? This only removes the draft copy from your dashboard and cannot be undone."
    );
    if (!confirmed) return;

    setActioningDraftId(draftId);
    setActionError("");
    setActionNotice("");

    const { error } = await supabase
      .from("quiz_drafts")
      .delete()
      .eq("id", draftId)
      .eq("owner_id", user.id);

    if (error) {
      console.error("Error deleting quiz draft:", error);
      setActionError("Could not delete the draft.");
      setActioningDraftId(null);
      return;
    }

    setDrafts((current) => current.filter((draft) => draft.id !== draftId));
    setActionNotice("Draft deleted.");
    setActioningDraftId(null);
  }

  async function restoreVersionToDraft(version: QuizVersionRow) {
    if (!user) return;

    setActioningVersionId(version.id);
    setActionError("");
    setActionNotice("");

    try {
      const { data: draft, error: draftError } = await supabase
        .from("quiz_drafts")
        .insert({
          owner_id: user.id,
          quiz_id: version.quiz_id,
          title: `${version.title} Restored`,
          category: version.snapshot.category ?? version.category,
          emoji: version.snapshot.emoji ?? version.emoji,
          color: version.snapshot.color ?? version.color,
          is_public: version.snapshot.is_public ?? version.is_public,
          source_type: "manual",
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (draftError) throw draftError;

      const questions = questionsFromVersionSnapshot(version);

      for (const [questionIndex, question] of questions.entries()) {
        const { data: insertedQuestion, error: questionError } = await supabase
          .from("quiz_draft_questions")
          .insert({
            draft_id: draft.id,
            text: question.text,
            time_limit: question.timeLimit,
            points: question.points,
            order_index: questionIndex,
          })
          .select("id")
          .single();

        if (questionError) throw questionError;

        const answersPayload = question.answers.map((answer, answerIndex) => ({
          question_id: insertedQuestion.id,
          text: answer.text,
          is_correct: answer.isCorrect,
          order_index: answerIndex,
        }));

        if (answersPayload.length > 0) {
          const { error: answersError } = await supabase
            .from("quiz_draft_answers")
            .insert(answersPayload);

          if (answersError) throw answersError;
        }
      }

      router.push(`/create?draft=${draft.id}`);
    } catch (error) {
      console.error("Error restoring version to draft:", error);
      setActionError("Could not restore this version into a draft.");
    } finally {
      setActioningVersionId(null);
    }
  }

  return (
    <div style={{ minHeight: "calc(100vh - 72px)", background: "var(--bg)", paddingBottom: "5rem" }}>
      <div className="container" style={{ paddingTop: "3rem" }}>
        <PageHero
          eyebrow="Creator Dashboard"
          title="My Library"
          description="Manage saved drafts, published quizzes, and hosted game performance from one place."
          accent="linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)"
          actions={
            <>
              <Link href="/create" className="btn btn-primary" style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.22)" }}>
                New Quiz
              </Link>
              <Link href="/explore" className="btn btn-secondary" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", borderColor: "rgba(255,255,255,0.24)" }}>
                Browse Public Quizzes
              </Link>
            </>
          }
        />

        {createdQuizId && (
          <div
            className="card"
            style={{
              padding: "1rem 1.25rem",
              marginBottom: "1.5rem",
              border: "1px solid var(--line)",
              background: "var(--accent-light)",
            }}
          >
            <strong>Quiz published.</strong> It is now part of your dashboard library.
          </div>
        )}

        {updatedQuizId && (
          <div
            className="card"
            style={{
              padding: "1rem 1.25rem",
              marginBottom: "1.5rem",
              border: "1px solid var(--line)",
              background: "var(--secondary-light)",
            }}
          >
            <strong>Quiz republished.</strong>
            {" "}
            {updatedVersion ? `Version ${updatedVersion} is now live.` : "A new version is now live."}
          </div>
        )}

        {actionNotice && (
          <div
            className="card"
            style={{
              padding: "1rem 1.25rem",
              marginBottom: "1.5rem",
              border: "1px solid var(--line)",
              background: "var(--success-light)",
            }}
          >
            <strong style={{ color: "var(--success)" }}>{actionNotice}</strong>
          </div>
        )}

        {actionError && (
          <div
            className="card"
            style={{
              padding: "1rem 1.25rem",
              marginBottom: "1.5rem",
              border: "1px solid var(--line)",
              background: "var(--primary-light)",
            }}
          >
            <strong style={{ color: "var(--primary)" }}>{actionError}</strong>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <MetricCard label="Active Quizzes" value={activeQuizzes.length} />
          <MetricCard label="Hosted Games" value={hostedGames} tone="var(--secondary)" />
          <MetricCard label="Players Reached" value={hostedPlayers} tone="var(--success)" />
          <MetricCard label="Quiz Plays" value={totalQuizPlays} tone="var(--primary)" />
        </div>

        {drafts.length > 0 && (
          <SectionCard
            title="Saved Drafts"
            description="Continue editing drafts saved to your account or jump back into live hosting for already published work."
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
              <Link href="/create" className="btn btn-secondary">
                New Draft
              </Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
              {drafts.map((draft) => (
                <div key={draft.id} className="card" style={{ padding: "1.5rem", border: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: `${draft.color ?? "var(--accent)"}15`, display: "grid", placeItems: "center", fontSize: "1.5rem" }}>
                      {draft.emoji || "📝"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {draft.title || "Untitled Draft"}
                      </div>
                      <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
                        {draft.source_type.replace("-", " ")} • {new Date(draft.updated_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.5rem" }}>
                    <Link href={`/create?draft=${draft.id}`} className="btn btn-primary" style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem" }}>
                      Continue
                    </Link>
                    {draft.quiz_id ? (
                      <Link href={`/host?quiz=${draft.quiz_id}`} className="btn btn-secondary" style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem" }}>
                        Host Live
                      </Link>
                    ) : (
                      <div className="btn btn-secondary" style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem", opacity: 0.45, pointerEvents: "none" }}>
                        Unpublished
                      </div>
                    )}
                    <button
                      onClick={() => void deleteDraft(draft.id)}
                      disabled={actioningDraftId === draft.id}
                      className="btn btn-secondary"
                      style={{
                        flex: 1,
                        fontSize: "0.875rem",
                        padding: "0.5rem",
                        color: "var(--primary)",
                        borderColor: "rgba(225, 29, 72, 0.18)",
                        background: "var(--primary-light)",
                      }}
                    >
                      {actioningDraftId === draft.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {versions.length > 0 && (
          <div style={{ marginTop: drafts.length > 0 ? "1.5rem" : 0, marginBottom: "2rem" }}>
            <SectionCard
              title="Recent Versions"
              description="Each republish writes a version snapshot. Use these entries to reopen an earlier snapshot in the builder."
            >
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className="card"
                    style={{
                      padding: "1rem 1.1rem",
                      border: "1px solid var(--line)",
                      boxShadow: "var(--shadow-sm)",
                      background: "linear-gradient(180deg, var(--surface), var(--bg-subtle))",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "1rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div className="font-display" style={{ fontSize: "1rem", fontWeight: 800, color: "var(--ink)" }}>
                          {version.title} <span style={{ color: "var(--accent)" }}>v{version.version_number}</span>
                        </div>
                        <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
                          {version.category} • {new Date(version.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          onClick={() => void restoreVersionToDraft(version)}
                          disabled={actioningVersionId === version.id}
                          className="btn btn-primary"
                          style={{ padding: "0.5rem 0.85rem", fontSize: "0.875rem" }}
                        >
                          {actioningVersionId === version.id ? "Restoring..." : "Restore As Draft"}
                        </button>
                        <Link href={`/create?version=${version.id}`} className="btn btn-secondary" style={{ padding: "0.5rem 0.85rem", fontSize: "0.875rem" }}>
                          Open Snapshot
                        </Link>
                        <Link href={`/create?quiz=${version.quiz_id}`} className="btn btn-primary" style={{ padding: "0.5rem 0.85rem", fontSize: "0.875rem" }}>
                          Edit Current
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* Quizzes Grid */}
        {activeQuizzes.length === 0 ? (
          <div className="card" style={{ padding: "3rem", textAlign: "center", border: "2px dashed var(--line)" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📭</div>
            <h3 style={{ fontWeight: 700, marginBottom: "0.5rem" }}>No quizzes yet</h3>
            <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>Create your first quiz to get started</p>
            <Link href="/create" className="btn btn-primary">Create Quiz</Link>
          </div>
        ) : (
          <SectionCard
            title="Published Quizzes"
            description="Jump between host, edit, and study flows without leaving the same dashboard surface."
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
              {activeQuizzes.map((q) => (
                <div key={q.id} className="card card-hover" style={{ padding: "1.5rem", border: "1px solid var(--line)", background: "linear-gradient(180deg, var(--surface), var(--bg-subtle))" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: `${q.color}15`, display: "grid", placeItems: "center", fontSize: "1.5rem" }}>
                      {q.emoji || "📝"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, color: "var(--ink)" }}>{q.title}</div>
                      <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
                        {q.questions?.[0]?.count ?? 0} questions · {(q.plays ?? 0).toLocaleString()} plays
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "0.45rem 0.75rem",
                        borderRadius: "999px",
                        background: q.is_public ? "var(--success-light)" : "var(--warning-light)",
                        color: q.is_public ? "var(--success)" : "var(--warning)",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {q.is_public ? "Public" : "Private"}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <Link href={`/host?quiz=${q.id}`} className="btn btn-primary" style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem" }}>
                      Host
                    </Link>
                    <Link href={`/create?quiz=${q.id}`} className="btn btn-secondary" style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem" }}>
                      Edit
                    </Link>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.5rem" }}>
                    <Link href={`/create?quiz=${q.id}&duplicate=1`} className="btn btn-secondary" style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem" }}>
                      Duplicate
                    </Link>
                    <Link href={`/study/${q.id}`} className="btn btn-secondary" style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem" }}>
                      Study
                    </Link>
                    <button
                      onClick={() => void updateVisibility(q.id, !q.is_public)}
                      disabled={actioningQuizId === q.id}
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem" }}
                    >
                      {actioningQuizId === q.id ? "..." : q.is_public ? "Make Private" : "Make Public"}
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <button
                      onClick={() => void updateArchiveState(q.id, true)}
                      disabled={actioningQuizId === q.id}
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem" }}
                    >
                      {actioningQuizId === q.id ? "..." : "Archive"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {archivedQuizzes.length > 0 && (
          <div style={{ marginTop: "1.5rem" }}>
            <SectionCard
              title="Archived Quizzes"
              description="Archived quizzes are hidden from discovery and hosting lists until restored."
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
                {archivedQuizzes.map((q) => (
                  <div key={q.id} className="card" style={{ padding: "1.5rem", border: "1px dashed var(--line-strong)", background: "var(--surface)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                      <div style={{ width: 52, height: 52, borderRadius: 16, background: `${q.color}12`, display: "grid", placeItems: "center", fontSize: "1.5rem", opacity: 0.7 }}>
                        {q.emoji || "📝"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, color: "var(--ink)" }}>{q.title}</div>
                        <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
                          Archived {q.archived_at ? new Date(q.archived_at).toLocaleString() : ""}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
                      <Link href={`/create?quiz=${q.id}&duplicate=1`} className="btn btn-secondary" style={{ fontSize: "0.875rem", padding: "0.5rem" }}>
                        Duplicate
                      </Link>
                      <button
                        onClick={() => void updateArchiveState(q.id, false)}
                        disabled={actioningQuizId === q.id}
                        className="btn btn-primary"
                        style={{ fontSize: "0.875rem", padding: "0.5rem" }}
                      >
                        {actioningQuizId === q.id ? "..." : "Restore"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {recentGames.length > 0 && (
          <div style={{ marginTop: "3rem" }}>
            <SectionCard
              title="Recent Hosted Games"
              description="Quick visibility into room size and top scores from your latest live sessions."
            >
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {recentGames.map((game) => (
                <div
                  key={game.id}
                  className="card"
                  style={{
                    padding: "1rem 1.25rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>PIN {game.pin}</div>
                    <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
                      {game.player_count ?? 0} players •{" "}
                      {new Date(game.finished_at).toLocaleString()}
                    </div>
                  </div>
                  <span style={{ color: "var(--muted)", fontWeight: 700 }}>
                    {getBestHostedScore([game]).toLocaleString()} top score
                  </span>
                </div>
              ))}
            </div>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>Loading...</div>}>
      <DashboardPageContent />
    </Suspense>
  );
}

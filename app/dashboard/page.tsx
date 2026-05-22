"use client";

import React from "react";
import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { OnboardingChecklist } from "@/components/shared/OnboardingChecklist";
import {
  type GameResultRow,
  getHostedGameCount,
  getRecentHostedResults,
  getTotalHostedPlayers,
} from "@/lib/reporting/game-results";
import {
  questionsFromVersionSnapshot,
  type QuizDraftRow,
  type QuizVersionRow,
} from "@/lib/quiz-drafts";
import { SectionCard } from "@/components/section-card";
import { LoadingPanel, StatusPanel } from "@/components/shared/status-panel";
import { MetricCard } from "@/components/shared/metric-card";
import {
  ArchivedQuizCard,
  DashboardMetricGrid,
  DashboardNotice,
  DraftCard,
  PublishedQuizCard,
  RecentGameCard,
  VersionCard,
  type DashboardQuizRow as QuizRow,
} from "@/components/dashboard/dashboard-cards";

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
  const [actioningVersionId, setActioningVersionId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [showNameBanner, setShowNameBanner] = useState(false);
  const [profileCreatedAt, setProfileCreatedAt] = useState<string | null>(null);
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
      try {
      const [
        { data, error },
        { data: draftRows, error: draftError },
        { data: versionRows, error: versionError },
        { data: resultRows, error: resultError },
        { data: profileData },
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
            .order("updated_at", { ascending: false })
            .limit(6),
          supabase
            .from("quiz_versions")
            .select("id, quiz_id, creator_id, version_number, title, category, emoji, color, is_public, snapshot, created_at")
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("game_results")
            .select("id, pin, quiz_id, host_id, player_count, finished_at, results")
            .eq("host_id", userId)
            .order("finished_at", { ascending: false })
            .limit(20),
          supabase
            .from("profiles")
            .select("display_name, created_at")
            .eq("id", userId)
            .single(),
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
      setShowNameBanner(!profileData?.display_name);
      setProfileCreatedAt((profileData as { created_at?: string } | null)?.created_at ?? null);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchQuizzes();
    return () => {
      ignore = true;
    };
  }, [user]);

  if (authLoading || loading) return <LoadingPanel />;

  if (!user) {
    return (
      <StatusPanel
        icon="🔐"
        title="Sign In Required"
        message="Sign in to manage the quizzes attached to your account."
        actionHref="/login"
        actionLabel="Sign In"
      />
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
    <div className="dashboard-shell">
      {/* Welcome banner for new users */}
      <WelcomeBanner profileCreatedAt={profileCreatedAt} />

      {/* Hero matching profile page style */}
      <div className="profile-hero">
        <div className="container profile-hero-content">
          <div className="profile-hero-info">
            <h1 className="font-display profile-hero-name">My Library</h1>
            <p className="profile-hero-email">Manage saved drafts, published quizzes, and hosted game performance from one place.</p>
          </div>
          <div className="profile-hero-actions">
            <Link href="/create" className="btn btn-primary btn-compact">New Quiz</Link>
            <Link href="/explore" className="btn btn-secondary btn-compact">Browse Quizzes</Link>
          </div>
        </div>
      </div>

      <div className="container dashboard-container">

        {createdQuizId && (
          <div className="card dashboard-notice dashboard-notice--created">
            <strong>Quiz published.</strong> It is now part of your dashboard library.
          </div>
        )}

        {updatedQuizId && (
          <div className="card dashboard-notice dashboard-notice--updated">
            <strong>Quiz republished.</strong>
            {" "}
            {updatedVersion ? `Version ${updatedVersion} is now live.` : "A new version is now live."}
          </div>
        )}

        <DashboardNotice message={actionNotice} tone="success" />
        <DashboardNotice message={actionError} tone="primary" />

        {showNameBanner && (
          <div className="card dashboard-name-banner">
            <div>
              <strong className="dashboard-name-banner-title">Set your display name</strong>
              <p className="text-muted dashboard-name-banner-desc">Choose a display name so other players don't see your email.</p>
            </div>
            <Link href="/profile" className="btn btn-primary btn-compact">Set Name</Link>
          </div>
        )}

        <DashboardMetricGrid>
          <MetricCard label="Active Quizzes" value={activeQuizzes.length} />
          <MetricCard label="Hosted Games" value={hostedGames} tone="var(--secondary)" />
          <MetricCard label="Players Reached" value={hostedPlayers} tone="var(--success)" />
          <MetricCard label="Quiz Plays" value={totalQuizPlays} tone="var(--primary)" />
        </DashboardMetricGrid>

        {drafts.length > 0 && (
          <SectionCard
            title="Saved Drafts"
            description="Continue editing drafts saved to your account or jump back into live hosting for already published work."
          >
            <div className="dashboard-draft-header">
              <Link href="/create" className="btn btn-secondary">New Draft</Link>
            </div>

            <div className="dashboard-card-grid">
              {drafts.map((draft) => (
                <DraftCard key={draft.id} draft={draft} />
              ))}
            </div>
          </SectionCard>
        )}

        {versions.length > 0 && (
          <div className={drafts.length > 0 ? "dashboard-section-gap mb-lg" : "mb-lg"}>
            <SectionCard
              title="Recent Versions"
              description="Each republish writes a version snapshot. Use these entries to reopen an earlier snapshot in the builder."
            >
              <div className="dashboard-version-grid">
                {versions.map((version) => (
                  <VersionCard
                    key={version.id}
                    version={version}
                    actioningVersionId={actioningVersionId}
                    onRestore={(selectedVersion) => void restoreVersionToDraft(selectedVersion)}
                  />
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {activeQuizzes.length === 0 ? (
          <OnboardingChecklist
            hasDisplayName={!showNameBanner}
            quizzesCreated={quizzes.length}
            gamesPlayed={gameResults.length}
          />
        ) : (
          <SectionCard
            title="Published Quizzes"
            description="Jump between host, edit, and study flows without leaving the same dashboard surface."
          >
            <div className="dashboard-card-grid">
              {activeQuizzes.map((q) => (
                <PublishedQuizCard
                  key={q.id}
                  quiz={q}
                  actioningQuizId={actioningQuizId}
                  onArchive={(quizId, archived) => void updateArchiveState(quizId, archived)}
                  onVisibility={(quizId, isPublic) => void updateVisibility(quizId, isPublic)}
                />
              ))}
            </div>
          </SectionCard>
        )}

        {archivedQuizzes.length > 0 && (
          <div className="dashboard-section-gap">
            <SectionCard
              title="Archived Quizzes"
              description="Archived quizzes are hidden from discovery and hosting lists until restored."
            >
              <div className="dashboard-card-grid">
                {archivedQuizzes.map((q) => (
                  <ArchivedQuizCard
                    key={q.id}
                    quiz={q}
                    actioningQuizId={actioningQuizId}
                    onArchive={(quizId, archived) => void updateArchiveState(quizId, archived)}
                  />
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {recentGames.length > 0 && (
          <div className="mt-lg">
            <SectionCard
              title="Recent Hosted Games"
              description="Quick visibility into room size and top scores from your latest live sessions."
            >
            <div className="dashboard-version-grid">
              {recentGames.map((game) => (
                <RecentGameCard key={game.id} game={game} />
              ))}
            </div>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}


function WelcomeBanner({ profileCreatedAt }: { profileCreatedAt: string | null }) {
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("qw_welcome_dismissed") === "1") {
      setDismissed(true);
    }
  }, []);

  const isNew = React.useMemo(() => {
    if (!profileCreatedAt) return false;
    const created = new Date(profileCreatedAt).getTime();
    return Date.now() - created < 7 * 24 * 60 * 60 * 1000;
  }, [profileCreatedAt]);

  if (dismissed || !isNew) return null;

  function dismiss() {
    if (typeof window !== "undefined") {
      localStorage.setItem("qw_welcome_dismissed", "1");
    }
    setDismissed(true);
  }

  return (
    <div
      style={{
        background: "linear-gradient(135deg, var(--accent, #7c3aed), #a78bfa)",
        color: "#fff",
        padding: "1.75rem 1.5rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative blobs */}
      <div
        style={{
          position: "absolute",
          top: "-40px",
          right: "-40px",
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-30px",
          left: "-20px",
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          pointerEvents: "none",
        }}
      />

      {/* Dismiss X */}
      <button
        onClick={dismiss}
        aria-label="Dismiss welcome banner"
        style={{
          position: "absolute",
          top: "0.875rem",
          right: "0.875rem",
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.3)",
          color: "#fff",
          borderRadius: "50%",
          width: 30,
          height: 30,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1rem",
          lineHeight: 1,
          zIndex: 1,
        }}
      >
        ✕
      </button>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.25rem",
          flexWrap: "wrap",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Left icon */}
        <div
          style={{
            fontSize: "2.75rem",
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          👋
        </div>

        {/* Text + CTAs */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3
            style={{
              color: "#fff",
              fontSize: "1.1875rem",
              fontWeight: 800,
              margin: "0 0 0.25rem",
              letterSpacing: "-0.01em",
            }}
          >
            Welcome to QuizWorld!
          </h3>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.875rem", margin: "0 0 1rem" }}>
            You&apos;re all set — explore quizzes from the community or build your own in minutes.
          </p>
          <div
            className="welcome-banner-actions"
            style={{
              display: "flex",
              gap: "0.625rem",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/explore"
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.4)",
                color: "#fff",
                padding: "0.5rem 1.125rem",
                borderRadius: "999px",
                fontSize: "0.875rem",
                fontWeight: 700,
                textDecoration: "none",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              🔍 Explore Quizzes
            </Link>
            <Link
              href="/create"
              style={{
                background: "#fff",
                border: "1px solid rgba(255,255,255,0.6)",
                color: "var(--accent, #7c3aed)",
                padding: "0.5rem 1.125rem",
                borderRadius: "999px",
                fontSize: "0.875rem",
                fontWeight: 700,
                textDecoration: "none",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              ✏️ Create Quiz
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="container loading-panel">Loading...</div>}>
      <DashboardPageContent />
    </Suspense>
  );
}

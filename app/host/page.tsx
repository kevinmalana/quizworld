"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { HostIcon } from "@/components/shared/host-icon";
import { CATEGORY_EMOJIS } from "@/lib/store";
import { createPhoenixSession } from "@/lib/game-engine/client";
import {
  isPhoenixGameEngine,
  legacySupabaseGameEngine,
  liveGameEngineMisconfigured,
} from "@/lib/game-engine/config";
import { writeHostSession } from "@/lib/host-session";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generatePin(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pin = "";
  for (let i = 0; i < 6; i++) pin += chars[Math.floor(Math.random() * chars.length)];
  return pin;
}

function toPhoenixQuestions(quiz: QuizFull) {
  return [...(quiz.questions ?? [])]
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map(q => ({
      id: q.id,
      text: q.text,
      image_url: q.image_url || null,
      video_url: q.video_url || null,
      time_limit: q.time_limit ?? 20,
      points: q.points ?? 1000,
      order_index: q.order_index ?? 0,
      answers: (q.answers ?? []).map(a => ({
        id: a.id,
        text: a.text,
        image_url: a.image_url || null,
        is_correct: a.is_correct ?? false,
      })),
    }));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type QuizSummary = {
  id: string;
  title: string;
  emoji: string | null;
  color: string | null;
  category: string;
  question_count: number;
  plays: number;
  is_mine: boolean;
};

type QuizFull = QuizSummary & {
  questions: {
    id: string; text: string; image_url: string | null; video_url: string | null;
    time_limit: number; points: number; order_index: number;
    answers: { id: string; text: string; image_url: string | null; is_correct: boolean }[];
  }[];
};

// ─── Quiz selection card ──────────────────────────────────────────────────────

function QuizCard({
  quiz,
  selected,
  onClick,
}: {
  quiz: QuizSummary;
  selected: boolean;
  onClick: () => void;
}) {
  const emoji = quiz.emoji || CATEGORY_EMOJIS[quiz.category] || "📝";
  return (
    <button
      onClick={onClick}
      className={`host-quiz-card${selected ? " host-quiz-card--selected" : ""}`}
    >
      <div className="host-quiz-card__emoji" style={{ background: `${quiz.color || "#7c3aed"}15` }}>
        {emoji}
      </div>
      <div className="host-quiz-card__info">
        <div className="host-quiz-card__title">{quiz.title}</div>
        <div className="host-quiz-card__meta">
          <span>{quiz.question_count} questions</span>
          {quiz.plays > 0 && <span>▶️ {quiz.plays} plays</span>}
          {quiz.is_mine && <span className="host-quiz-card__mine">✏️ Mine</span>}
        </div>
      </div>
      {selected && <span className="host-quiz-card__check">✓</span>}
    </button>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function HostPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedId = searchParams.get("quiz");
  const { user, loading: authLoading } = useAuth();

  const [myQuizzes, setMyQuizzes] = useState<QuizSummary[]>([]);
  const [publicQuizzes, setPublicQuizzes] = useState<QuizSummary[]>([]);
  const [recentQuizIds, setRecentQuizIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(preSelectedId);
  const [search, setSearch] = useState("");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [section, setSection] = useState<"mine" | "recent" | "public">("mine");

  useEffect(() => {
    if (!user) return;

    async function load() {
      // Load quiz summaries only (no question data — loaded at launch time)
      const { data } = await supabase
        .from("quizzes")
        .select("id, title, emoji, color, category, plays, creator_id, questions(count)")
        .or(`is_public.eq.true,creator_id.eq.${user!.id}`)
        .is("archived_at", null)
        .order("plays", { ascending: false })
        .limit(100);

      if (!data) return;

      const mine: QuizSummary[] = [];
      const pub: QuizSummary[] = [];

      data.forEach(q => {
        const isMine = q.creator_id === user!.id;
        const summary: QuizSummary = {
          id: q.id,
          title: q.title,
          emoji: q.emoji,
          color: q.color,
          category: q.category,
          question_count: (q.questions as unknown as { count: number }[])?.[0]?.count ?? 0,
          plays: q.plays ?? 0,
          is_mine: isMine,
        };
        if (isMine) mine.push(summary);
        else pub.push(summary);
      });

      setMyQuizzes(mine);
      setPublicQuizzes(pub);

      // Auto-select pre-selected quiz
      if (preSelectedId) {
        setSelectedId(preSelectedId);
        const found = [...mine, ...pub].find(q => q.id === preSelectedId);
        if (found) setSection(found.is_mine ? "mine" : "public");
      } else if (mine.length > 0) {
        // Default to My Quizzes section, no auto-select
        setSection("mine");
      } else {
        setSection("public");
      }

      // Recent hosted quizzes from localStorage
      try {
        const recent = JSON.parse(localStorage.getItem("qw_recent_hosted") || "[]") as string[];
        setRecentQuizIds(recent.filter(id => data.some(q => q.id === id)));
      } catch { /* ignore */ }
    }

    load();
  }, [user?.id, preSelectedId]);

  const recentQuizzes = useMemo(() => {
    const all = [...myQuizzes, ...publicQuizzes];
    return recentQuizIds.map(id => all.find(q => q.id === id)).filter(Boolean) as QuizSummary[];
  }, [recentQuizIds, myQuizzes, publicQuizzes]);

  const filteredPublic = useMemo(() => {
    if (!search.trim()) return publicQuizzes.slice(0, 20);
    const q = search.toLowerCase();
    return publicQuizzes.filter(quiz =>
      quiz.title.toLowerCase().includes(q) || quiz.category.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [publicQuizzes, search]);

  const activeList = section === "mine" ? myQuizzes
    : section === "recent" ? recentQuizzes
    : filteredPublic;

  const selectedQuiz = [...myQuizzes, ...publicQuizzes].find(q => q.id === selectedId) ?? null;

  async function handleLaunch() {
    if (!user || !selectedId) return;
    setLaunching(true);
    setError("");

    try {
      // Fetch full quiz data only at launch time
      const { data: fullQuiz } = await supabase
        .from("quizzes")
        .select("*, questions(*, answers(*))")
        .eq("id", selectedId)
        .single();

      if (!fullQuiz) throw new Error("Quiz not found.");

      // Track recent
      try {
        const recent = JSON.parse(localStorage.getItem("qw_recent_hosted") || "[]") as string[];
        const updated = [selectedId, ...recent.filter(id => id !== selectedId)].slice(0, 5);
        localStorage.setItem("qw_recent_hosted", JSON.stringify(updated));
      } catch { /* ignore */ }

      if (isPhoenixGameEngine) {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (!authSession?.access_token) throw new Error("Sign in again before hosting.");

        const response = await createPhoenixSession({
          quiz_id: fullQuiz.id,
          game_mode: "classic",
          questions: toPhoenixQuestions(fullQuiz as QuizFull),
        }, authSession.access_token);

        if (!response?.host_token || !response?.session?.pin) throw new Error("Could not start game session.");

        writeHostSession(response.session.pin, { hostId: user.id, hostToken: response.host_token });
        router.push(`/game/${response.session.pin}`);
        return;
      } else {
        const newPin = generatePin();
        const { error: sessionError } = await supabase.from("game_sessions").insert({
          pin: newPin, quiz_id: fullQuiz.id, host_id: user.id,
          status: "waiting", current_question_index: -1, game_mode: "classic",
        });
        if (sessionError) throw sessionError;
        router.push(`/game/${newPin}`);
        return;
      }
    } catch (err) {
      console.error("Launch error:", err);
      setError(err instanceof Error ? err.message : "Failed to create game. Try again.");
    } finally {
      setLaunching(false);
    }
  }

  // ── Guard states ─────────────────────────────────────────────────────────

  if (authLoading) return <div className="container report-status">Loading...</div>;

  if (liveGameEngineMisconfigured || legacySupabaseGameEngine) {
    return (
      <div className="container game-status-panel">
        <div className="card game-status-card">
          <div className="game-status-icon">⚙️</div>
          <h1 className="font-display game-status-title">Live Games Unavailable</h1>
          <p className="game-status-text">The live game service isn&apos;t reachable right now. Please try again shortly.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container join-shell">
        <div className="card join-card">
          <div className="join-icon">🏁</div>
          <h1 className="font-display join-title">Host a Live Game</h1>
          <p className="join-subtitle">Sign in to pick a quiz and launch a live multiplayer session. Players join from any device with a 6-character PIN.</p>
          <button
            onClick={() => { sessionStorage.setItem("qw_post_login_redirect", "/host"); router.push("/login"); }}
            className="btn btn-primary btn-lg btn-full mb-sm"
          >Sign In to Host</button>
          <Link href="/explore" className="btn btn-secondary btn-full">Browse Quizzes First</Link>
        </div>
      </div>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────────────────

  return (
    <div className="container host-shell">
      <div className="host-header">
        <div>
          <h1 className="font-display host-title"><HostIcon size={24} /> Host a Game</h1>
          <p className="host-subtitle">Pick a quiz · Share the PIN · Play live</p>
        </div>
        {selectedQuiz && (
          <button
            onClick={handleLaunch}
            disabled={launching}
            className="btn btn-primary btn-lg host-launch-btn--header"
          >
            {launching ? "Starting..." : "Launch 🚀"}
          </button>
        )}
      </div>

      {/* Selected quiz preview */}
      {selectedQuiz ? (
        <div className="card host-selected-card">
          <div className="host-selected-inner">
            <div className="host-selected-emoji" style={{ background: `${selectedQuiz.color || "#7c3aed"}15` }}>
              {selectedQuiz.emoji || CATEGORY_EMOJIS[selectedQuiz.category] || "📝"}
            </div>
            <div className="host-selected-info">
              <div className="host-selected-label">Selected Quiz</div>
              <div className="host-selected-title">{selectedQuiz.title}</div>
              <div className="host-selected-meta">
                <span>📝 {selectedQuiz.question_count} questions</span>
                <span>{selectedQuiz.category}</span>
                {selectedQuiz.plays > 0 && <span>▶️ {selectedQuiz.plays} plays</span>}
              </div>
            </div>
            <button className="btn btn-secondary btn-compact" onClick={() => setSelectedId(null)}>Change</button>
          </div>
        </div>
      ) : (
        <div className="card host-empty-selection">
          <span className="host-empty-icon">👆</span>
          <span>Select a quiz below to get started</span>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {/* Section tabs */}
      <div className="social-tabs host-section-tabs">
        <button className={`social-tab${section === "mine" ? " is-active" : ""}`} onClick={() => setSection("mine")}>
          ✏️ My Quizzes {myQuizzes.length > 0 && `(${myQuizzes.length})`}
        </button>
        {recentQuizzes.length > 0 && (
          <button className={`social-tab${section === "recent" ? " is-active" : ""}`} onClick={() => setSection("recent")}>
            🕐 Recently Hosted ({recentQuizzes.length})
          </button>
        )}
        <button className={`social-tab${section === "public" ? " is-active" : ""}`} onClick={() => setSection("public")}>
          🌐 Public Library ({publicQuizzes.length})
        </button>
      </div>

      {/* Search — only on public */}
      {section === "public" && (
        <div className="host-search-wrap">
          <input
            className="host-search-input"
            placeholder="Search public quizzes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Quiz list */}
      {activeList.length === 0 ? (
        <div className="host-empty">
          {section === "mine" ? (
            <>
              <div className="host-empty-title">You haven&apos;t created any quizzes yet</div>
              <Link href="/create" className="btn btn-primary">Create Your First Quiz</Link>
            </>
          ) : section === "recent" ? (
            <div className="host-empty-title">No recently hosted quizzes</div>
          ) : (
            <div className="host-empty-title">No quizzes match &quot;{search}&quot;</div>
          )}
        </div>
      ) : (
        <div className="host-quiz-list">
          {activeList.map(quiz => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              selected={selectedId === quiz.id}
              onClick={() => setSelectedId(quiz.id)}
            />
          ))}
        </div>
      )}

      {/* Launch button — bottom sticky on mobile */}
      {selectedQuiz && (
        <div className="host-launch-bar">
          <button
            onClick={handleLaunch}
            disabled={launching}
            className="btn btn-primary btn-lg btn-full"
          >
            {launching ? "Starting game..." : `Launch "${selectedQuiz.title}" 🚀`}
          </button>
          {launching && <p className="host-launch-hint">Setting up live lobby...</p>}
        </div>
      )}
    </div>
  );
}

export default function HostPage() {
  return (
    <Suspense fallback={<div className="container report-status">Loading...</div>}>
      <HostPageContent />
    </Suspense>
  );
}

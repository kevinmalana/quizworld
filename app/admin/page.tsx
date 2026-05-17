"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";

type Profile    = { id: string; username: string | null; is_admin: boolean | null; created_at: string };
type Quiz       = { id: string; title: string; plays: number; is_public: boolean; created_at: string };
type GameResult = { id: string; pin: string; player_count: number; finished_at: string };
type GameSession = { id: string; pin: string; status: string; created_at: string };

type Tab = "overview" | "users" | "quizzes" | "games" | "health";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "📊 Overview" },
  { key: "users",    label: "👥 Users" },
  { key: "quizzes",  label: "📝 Quizzes" },
  { key: "games",    label: "🎮 Games" },
  { key: "health",   label: "🩺 Health" },
];

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin]         = useState<boolean | null>(null);
  const [tab, setTab]                 = useState<Tab>("overview");
  const [profiles, setProfiles]       = useState<Profile[]>([]);
  const [quizzes, setQuizzes]         = useState<Quiz[]>([]);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [gameSessions, setGameSessions] = useState<GameSession[]>([]);
  const [loading, setLoading]         = useState(true);
  const [phoenixHealth, setPhoenixHealth] = useState("checking...");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        const admin = data?.is_admin ?? false;
        setIsAdmin(admin);
        if (admin) loadAll();
      });
  }, [user]);

  async function loadAll() {
    setLoading(true);
    const [p, q, gr, gs] = await Promise.all([
      supabase.from("profiles").select("id,username,is_admin,created_at").order("created_at", { ascending: false }),
      supabase.from("quizzes").select("id,title,plays,is_public,created_at").order("created_at", { ascending: false }),
      supabase.from("game_results").select("id,pin,player_count,finished_at").order("finished_at", { ascending: false }).limit(50),
      supabase.from("game_sessions").select("id,pin,status,created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    setProfiles((p.data as Profile[]) ?? []);
    setQuizzes((q.data as Quiz[]) ?? []);
    setGameResults((gr.data as GameResult[]) ?? []);
    setGameSessions((gs.data as GameSession[]) ?? []);
    setLoading(false);

    try {
      const res  = await fetch("https://quizworld-xs0g.onrender.com/api/health", { signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      setPhoenixHealth(`${data.status} — redis:${data.redis}`);
    } catch {
      setPhoenixHealth("unreachable");
    }
  }

  if (authLoading)           return <div className="container loading-panel">Loading...</div>;
  if (!user)                 return <div className="container loading-panel"><p className="text-muted">Sign in to access admin.</p></div>;
  if (isAdmin === false)     return <div className="container loading-panel"><p className="text-muted">⛔ Not authorized.</p></div>;
  if (isAdmin === null || loading) return <div className="container loading-panel"><p className="text-muted">Loading admin data...</p></div>;

  const totalPlays     = quizzes.reduce((s, q) => s + (q.plays ?? 0), 0);
  const publicQuizzes  = quizzes.filter((q) => q.is_public).length;
  const activeSessions = gameSessions.filter((s) => s.status === "waiting" || s.status === "active");
  const healthOk       = phoenixHealth.includes("ok");

  return (
    <div className="container admin-page">
      <h1 className="font-display admin-title">⚙️ Admin Panel</h1>
      <p className="text-muted admin-subtitle">System administration for QuizWorld</p>

      <div className="report-tabs admin-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`report-tab${tab === t.key ? " is-active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="report-stats-grid">
            <StatCard label="Users"        value={profiles.length}    className="admin-stat-value--accent" />
            <StatCard label="Quizzes"      value={quizzes.length}     className="admin-stat-value--secondary" />
            <StatCard label="Total Plays"  value={totalPlays}         className="admin-stat-value--success" />
            <StatCard label="Game Results" value={gameResults.length} className="admin-stat-value--primary" />
          </div>
          <div className="report-stats-grid">
            <StatCard label="Public Quizzes"  value={publicQuizzes} />
            <StatCard label="Active Sessions" value={activeSessions.length} />
            <div className="report-stat-card">
              <div className="report-stat-label">Phoenix</div>
              <div className={`report-stat-value admin-stat-value--sm admin-health-value ${healthOk ? "admin-health-value--ok" : "admin-health-value--error"}`}>
                {phoenixHealth}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "users" && (
        <div className="report-question-list">
          {profiles.map((p) => (
            <div key={p.id} className="card report-player-card">
              <span className="report-player-avatar">👤</span>
              <div className="report-player-info">
                <div className="report-player-name">{p.username ?? "(no username)"}</div>
                <div className="report-player-accuracy">
                  {p.id.slice(0, 8)}... · joined {new Date(p.created_at).toLocaleDateString()}
                </div>
              </div>
              {p.is_admin && <span className="admin-badge">ADMIN</span>}
            </div>
          ))}
        </div>
      )}

      {tab === "quizzes" && (
        <div className="report-question-list">
          {quizzes.map((q) => (
            <div key={q.id} className="card report-question-card">
              <div className="report-question-header">
                <div className="report-question-text">
                  <div className="font-700">{q.title}</div>
                  <div className="report-player-accuracy">
                    {q.id.slice(0, 8)}... · created {new Date(q.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="admin-quiz-actions">
                  <span className="admin-quiz-plays">{q.plays} plays</span>
                  <span className={`report-difficulty-badge ${q.is_public ? "report-difficulty-badge--easy" : "report-difficulty-badge--hard"}`}>
                    {q.is_public ? "🌐 Public" : "🔒 Private"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "games" && (
        <>
          {activeSessions.length > 0 && (
            <div className="admin-section">
              <h3 className="admin-section-title">🔴 Active Sessions</h3>
              <div className="report-question-list">
                {activeSessions.map((s) => (
                  <div key={s.id} className="card report-player-card admin-active-session">
                    <span className="report-player-avatar">🎮</span>
                    <div className="report-player-info">
                      <div className="report-player-name">PIN: {s.pin}</div>
                      <div className="report-player-accuracy">
                        Status: {s.status} · started {new Date(s.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <h3 className="admin-section-title">📋 Recent Game Results</h3>
          <div className="report-question-list">
            {gameResults.map((g) => (
              <div key={g.id} className="card report-player-card">
                <span className="report-player-avatar">🏆</span>
                <div className="report-player-info">
                  <div className="report-player-name">PIN: {g.pin}</div>
                  <div className="report-player-accuracy">
                    {g.player_count} players · finished {new Date(g.finished_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "health" && (
        <div className="report-question-list">
          <HealthCard
            label="Phoenix Backend"
            url="https://quizworld-xs0g.onrender.com"
            status={phoenixHealth}
            ok={healthOk}
          />
          <HealthCard label="Supabase" url="https://tqmygnkwkjtkteguemya.supabase.co" status="connected" ok />
          <HealthCard label="Vercel"   url="https://www.quizworld.xyz"                 status="deployed"  ok />
          <div className="card report-question-card">
            <div className="report-question-header">
              <div className="font-700">Database</div>
              <span className="admin-health-value">
                {profiles.length} users · {quizzes.length} quizzes · {gameResults.length} results
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return (
    <div className="report-stat-card">
      <div className="report-stat-label">{label}</div>
      <div className={`report-stat-value ${className}`}>{value}</div>
    </div>
  );
}

function HealthCard({ label, url, status, ok }: { label: string; url: string; status: string; ok: boolean }) {
  return (
    <div className="card report-question-card">
      <div className="report-question-header">
        <div className="font-700">{label}</div>
        <span className={`admin-health-value ${ok ? "admin-health-value--ok" : "admin-health-value--error"}`}>
          {status}
        </span>
      </div>
      <div className="report-player-accuracy">{url}</div>
    </div>
  );
}

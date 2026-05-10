"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";

type Profile = { id: string; username: string | null; is_admin: boolean | null; created_at: string };
type Quiz = { id: string; title: string; plays: number; is_public: boolean; created_at: string; creator_id: string };
type GameResult = { id: string; pin: string; player_count: number; finished_at: string; host_id: string };
type GameSession = { id: string; pin: string; status: string; created_at: string };

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"overview" | "users" | "quizzes" | "games" | "health">("overview");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [gameSessions, setGameSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoenixHealth, setPhoenixHealth] = useState<string>("checking...");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("is_admin").eq("id", user.id).single().then(({ data }) => {
      setIsAdmin(data?.is_admin ?? false);
      if (data?.is_admin) loadAll();
    });
  }, [user]);

  async function loadAll() {
    setLoading(true);
    const [p, q, gr, gs] = await Promise.all([
      supabase.from("profiles").select("id,username,is_admin,created_at").order("created_at", { ascending: false }),
      supabase.from("quizzes").select("id,title,plays,is_public,created_at,creator_id").order("created_at", { ascending: false }),
      supabase.from("game_results").select("id,pin,player_count,finished_at,host_id").order("finished_at", { ascending: false }).limit(50),
      supabase.from("game_sessions").select("id,pin,status,created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    setProfiles((p.data as Profile[]) ?? []);
    setQuizzes((q.data as Quiz[]) ?? []);
    setGameResults((gr.data as GameResult[]) ?? []);
    setGameSessions((gs.data as GameSession[]) ?? []);
    setLoading(false);

    try {
      const res = await fetch("https://quizworld-xs0g.onrender.com/api/health", { signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      setPhoenixHealth(`${data.status} — redis:${data.redis}`);
    } catch { setPhoenixHealth("unreachable"); }
  }

  if (authLoading) return <div className="container loading-panel">Loading...</div>;
  if (!user) return <div className="container loading-panel"><p className="text-muted">Sign in to access admin.</p></div>;
  if (isAdmin === false) return <div className="container loading-panel"><p className="text-muted">⛔ Not authorized.</p></div>;
  if (isAdmin === null || loading) return <div className="container loading-panel"><p className="text-muted">Loading admin data...</p></div>;

  const totalPlays = quizzes.reduce((s, q) => s + (q.plays ?? 0), 0);
  const publicQuizzes = quizzes.filter(q => q.is_public).length;
  const activeSessions = gameSessions.filter(s => s.status === "waiting" || s.status === "active").length;

  const tabs = [
    { key: "overview" as const, label: "📊 Overview" },
    { key: "users" as const, label: "👥 Users" },
    { key: "quizzes" as const, label: "📝 Quizzes" },
    { key: "games" as const, label: "🎮 Games" },
    { key: "health" as const, label: "🩺 Health" },
  ];

  return (
    <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
      <h1 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 900, marginBottom: "0.5rem" }}>⚙️ Admin Panel</h1>
      <p className="text-muted" style={{ marginBottom: "1.5rem" }}>System administration for QuizWorld</p>

      <div className="report-tabs" style={{ marginBottom: "1.5rem" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? "report-tab is-active" : "report-tab"}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div>
          <div className="report-stats-grid">
            <div className="report-stat-card"><div className="report-stat-label">Users</div><div className="report-stat-value" style={{ color: "var(--accent)" }}>{profiles.length}</div></div>
            <div className="report-stat-card"><div className="report-stat-label">Quizzes</div><div className="report-stat-value" style={{ color: "var(--secondary)" }}>{quizzes.length}</div></div>
            <div className="report-stat-card"><div className="report-stat-label">Total Plays</div><div className="report-stat-value" style={{ color: "var(--success)" }}>{totalPlays}</div></div>
            <div className="report-stat-card"><div className="report-stat-label">Game Results</div><div className="report-stat-value" style={{ color: "var(--primary)" }}>{gameResults.length}</div></div>
          </div>
          <div className="report-stats-grid">
            <div className="report-stat-card"><div className="report-stat-label">Public Quizzes</div><div className="report-stat-value">{publicQuizzes}</div></div>
            <div className="report-stat-card"><div className="report-stat-label">Active Sessions</div><div className="report-stat-value">{activeSessions}</div></div>
            <div className="report-stat-card"><div className="report-stat-label">Phoenix</div><div className="report-stat-value" style={{ fontSize: "1rem", color: phoenixHealth.includes("ok") ? "var(--success)" : "var(--primary)" }}>{phoenixHealth}</div></div>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="report-question-list">
          {profiles.map(p => (
            <div key={p.id} className="card report-player-card">
              <span className="report-player-avatar">👤</span>
              <div className="report-player-info">
                <div className="report-player-name">{p.username ?? "(no username)"}</div>
                <div className="report-player-accuracy">{p.id.slice(0, 8)}... · joined {new Date(p.created_at).toLocaleDateString()}</div>
              </div>
              {p.is_admin && <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--accent)", background: "var(--accent-light)", padding: "0.2rem 0.5rem", borderRadius: 999 }}>ADMIN</span>}
            </div>
          ))}
        </div>
      )}

      {tab === "quizzes" && (
        <div className="report-question-list">
          {quizzes.map(q => (
            <div key={q.id} className="card report-question-card">
              <div className="report-question-header">
                <div className="report-question-text">
                  <div className="font-700">{q.title}</div>
                  <div className="report-player-accuracy">{q.id.slice(0, 8)}... · created {new Date(q.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>{q.plays} plays</span>
                  <span className={q.is_public ? "report-difficulty-badge report-difficulty-badge--easy" : "report-difficulty-badge report-difficulty-badge--hard"}>
                    {q.is_public ? "🌐 Public" : "🔒 Private"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "games" && (
        <div>
          {activeSessions > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ fontWeight: 800, marginBottom: "0.75rem" }}>🔴 Active Sessions</h3>
              <div className="report-question-list">
                {gameSessions.filter(s => s.status === "waiting" || s.status === "active").map(s => (
                  <div key={s.id} className="card report-player-card" style={{ border: "2px solid var(--success)" }}>
                    <span className="report-player-avatar">🎮</span>
                    <div className="report-player-info">
                      <div className="report-player-name">PIN: {s.pin}</div>
                      <div className="report-player-accuracy">Status: {s.status} · started {new Date(s.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <h3 style={{ fontWeight: 800, marginBottom: "0.75rem" }}>📋 Recent Game Results</h3>
          <div className="report-question-list">
            {gameResults.map(g => (
              <div key={g.id} className="card report-player-card">
                <span className="report-player-avatar">🏆</span>
                <div className="report-player-info">
                  <div className="report-player-name">PIN: {g.pin}</div>
                  <div className="report-player-accuracy">{g.player_count} players · finished {new Date(g.finished_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "health" && (
        <div>
          <div className="report-question-list">
            <div className="card report-question-card">
              <div className="report-question-header">
                <div className="font-700">Phoenix Backend</div>
                <span style={{ color: phoenixHealth.includes("ok") ? "var(--success)" : "var(--primary)", fontWeight: 700 }}>{phoenixHealth}</span>
              </div>
              <div className="report-player-accuracy">https://quizworld-xs0g.onrender.com</div>
            </div>
            <div className="card report-question-card">
              <div className="report-question-header">
                <div className="font-700">Supabase</div>
                <span style={{ color: "var(--success)", fontWeight: 700 }}>connected</span>
              </div>
              <div className="report-player-accuracy">https://tqmygnkwkjtkteguemya.supabase.co</div>
            </div>
            <div className="card report-question-card">
              <div className="report-question-header">
                <div className="font-700">Vercel</div>
                <span style={{ color: "var(--success)", fontWeight: 700 }}>deployed</span>
              </div>
              <div className="report-player-accuracy">https://www.quizworld.xyz</div>
            </div>
            <div className="card report-question-card">
              <div className="report-question-header">
                <div className="font-700">Database</div>
                <span style={{ fontWeight: 700 }}>{profiles.length} users · {quizzes.length} quizzes · {gameResults.length} results</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

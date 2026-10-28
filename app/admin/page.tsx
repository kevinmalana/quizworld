"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { PLAY_COUNTER_PROVENANCE } from "@/lib/catalog-metrics";
import type { AdminOverviewCounts } from "@/app/api/admin/overview/aggregates";

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
  const [overview, setOverview] = useState<AdminOverviewCounts | null>(null);
  const [dataOwner, setDataOwner] = useState<string | null>(null);
  const [listError, setListError] = useState(false);

  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    setIsAdmin(null);
    setDataOwner(null);
    setOverview(null);
    setPhoenixHealth("checking...");
    setProfiles([]);
    setQuizzes([]);
    setGameResults([]);
    setGameSessions([]);
    setListError(false);
    setLoading(true);
    if (!user) return () => controller.abort();
    const userId = user.id;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]);
    async function load() {
      try {
        const { data, error } = await supabase.from("profiles").select("is_admin").eq("id", userId).abortSignal(signal).single();
        if (!current) return;
        const admin = !error && data?.is_admin === true;
        setIsAdmin(admin);
        setDataOwner(userId);
        if (!admin) return;
        // Lists retain normal RLS and are not represented as global totals.
        const [p, q, gr, gs] = await Promise.all([
          supabase.from("profiles").select("id,username,is_admin,created_at").order("created_at", { ascending: false }).limit(500).abortSignal(signal),
          supabase.from("quizzes").select("id,title,plays,is_public,created_at").order("created_at", { ascending: false }).limit(500).abortSignal(signal),
          supabase.from("game_results").select("id,pin,player_count,finished_at").order("finished_at", { ascending: false }).limit(50).abortSignal(signal),
          supabase.from("game_sessions").select("id,pin,status,created_at").order("created_at", { ascending: false }).limit(50).abortSignal(signal),
        ]);
        if (!current) return;
        setProfiles(p.data ?? []);
        setQuizzes(q.data ?? []);
        setGameResults(gr.data ?? []);
        setGameSessions(gs.data ?? []);
        setListError(Boolean(p.error || q.error || gr.error || gs.error));
        setLoading(false);
        try {
          const res = await fetch("/api/admin/overview", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) });
          if (!res.ok || !current) return;
          const body = await res.json();
          if (current && body?.counts) setOverview(body.counts);
        } catch {
          // Missing aggregates remain unavailable, never visible-list totals.
        }
      } catch {
        if (current) { setLoading(false); setListError(true); setDataOwner(userId); setIsAdmin(value => value ?? false); }
      }
    }
    void load();
    void fetch("https://quizworld-xs0g.onrender.com/api/health", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) })
      .then(res => { if (!res.ok) throw new Error("Health unavailable"); return res.json(); })
      .then(data => { if (current) setPhoenixHealth(`${data.status} — redis:${data.redis}`); })
      .catch(() => { if (current) setPhoenixHealth("unavailable"); });
    return () => { current = false; controller.abort(); };
  }, [user?.id]);


  if (authLoading)           return <div className="container loading-panel">Loading...</div>;
  if (!user)                 return <div className="container loading-panel"><p className="text-muted">Sign in to access admin.</p></div>;
  if (dataOwner !== user.id) return <div className="container loading-panel">Checking authorization...</div>;
  if (isAdmin === false)     return <div className="container loading-panel"><p className="text-muted">⛔ Not authorized.</p></div>;
  if (isAdmin === null || loading) return <div className="container loading-panel"><p className="text-muted">Loading admin data...</p></div>;

  const activeSessions = gameSessions.filter((s) => s.status === "waiting" || s.status === "active");
  const healthOk       = phoenixHealth.includes("ok");

  const stat = (key: keyof AdminOverviewCounts): number | string => overview?.[key] ?? "—";

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

      <p className="text-muted">Lists show only RLS-visible rows: up to 500 users/quizzes and 50 games per list, not global totals. {listError && "One or more lists could not be loaded."}</p>
      {tab === "overview" && (
        <>
          <p className="text-muted">Server-authorized record counts; — means unavailable. Records may include QA/seed data and do not establish adoption. Legacy counter total is unavailable until a bounded aggregate exists.</p>
          <p className="text-muted">{PLAY_COUNTER_PROVENANCE}</p>
          <div className="report-stats-grid">
            <StatCard label="Users"        value={stat("profiles")}    className="admin-stat-value--accent" />
            <StatCard label="Quizzes"      value={stat("quizzes")}     className="admin-stat-value--secondary" />
            <StatCard label="Legacy play counter"  value={stat("total_plays")}         className="admin-stat-value--success" />
            <StatCard label="Game Results" value={stat("game_results")} className="admin-stat-value--primary" />
          </div>
          <div className="report-stats-grid">
            <StatCard label="Public Quizzes"  value={stat("public_quizzes")} />
            <StatCard label="Active Sessions" value={stat("active_game_sessions")} />
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
                  <span title={PLAY_COUNTER_PROVENANCE} className="admin-quiz-plays">{q.plays} plays</span>
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
          <HealthCard label="Supabase" url="https://tqmygnkwkjtkteguemya.supabase.co" status="not checked" ok={false} />
          <HealthCard label="Vercel"   url="https://www.quizworld.xyz"                 status="not checked" ok={false} />
          <div className="card report-question-card">
            <div className="report-question-header">
              <div className="font-700">Database</div>
              <span className="admin-health-value">
                Visible rows: {profiles.length} users · {quizzes.length} quizzes · {gameResults.length} results
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, className = "" }: { label: string; value: number | string; className?: string }) {
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

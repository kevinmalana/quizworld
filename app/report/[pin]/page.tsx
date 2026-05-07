"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type PlayerResult = {
  id: string;
  nickname: string;
  avatar?: string;
  score: number;
};

type AnswerDistribution = {
  answer_id: string;
  text: string;
  is_correct: boolean;
  count: number;
  percentage: number;
};

type QuestionBreakdown = {
  index: number;
  question_id: string;
  text: string;
  correct_answer_text?: string;
  time_limit: number;
  points: number;
  total_responses: number;
  correct_count: number;
  accuracy_pct: number;
  avg_response_time_ms: number;
  difficulty: string;
  distribution: AnswerDistribution[];
  responses: {
    player_id: string;
    nickname: string;
    avatar?: string;
    answer_id: string;
    is_correct: boolean;
    points_awarded: number;
    response_time_ms: number;
  }[];
};

type GameResult = {
  id: string;
  pin: string;
  quiz_id: string;
  host_id: string;
  player_count: number;
  results: {
    players: PlayerResult[];
    question_count: number;
    finished_status: string;
    question_breakdown?: QuestionBreakdown[];
  };
  finished_at: string;
};

function StatCard({ label, value, color = "var(--accent)" }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ padding: "1rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--line)", background: "linear-gradient(180deg, var(--surface), var(--bg-subtle))", textAlign: "center" }}>
      <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.5rem" }}>{label}</div>
      <div className="font-display" style={{ fontSize: "1.75rem", fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    easy: { bg: "var(--success-light)", text: "var(--success)" },
    medium: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b" },
    hard: { bg: "var(--primary-light)", text: "var(--primary)" },
  };
  const c = colors[difficulty] || colors.medium;
  return (
    <span style={{ fontSize: "0.6rem", fontWeight: 800, padding: "0.15rem 0.5rem", borderRadius: 999, background: c.bg, color: c.text, textTransform: "capitalize" }}>
      {difficulty === "easy" ? "🟢" : difficulty === "hard" ? "🔴" : "🟡"} {difficulty}
    </span>
  );
}

function AccuracyBar({ pct }: { pct: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--line)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, background: pct >= 80 ? "var(--success)" : pct >= 50 ? "#f59e0b" : "var(--primary)", transition: "width 0.5s" }} />
      </div>
      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", minWidth: 35, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

export default function ReportPage() {
  const params = useParams();
  const pin = params.pin as string;
  const [result, setResult] = useState<GameResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "players">("overview");

  useEffect(() => {
    async function load() {
      const { data, error: fetchError } = await supabase
        .from("game_results")
        .select("*")
        .eq("pin", pin)
        .single();

      if (fetchError || !data) {
        setError("Game report not found.");
        setLoading(false);
        return;
      }

      setResult(data as GameResult);
      setLoading(false);
    }
    load();
  }, [pin]);

  if (loading) {
    return <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>Loading report...</div>;
  }

  if (error || !result) {
    return (
      <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>
        <div className="card" style={{ padding: "3rem", maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📊</div>
          <h2 style={{ fontWeight: 800, marginBottom: "0.75rem" }}>Report Not Found</h2>
          <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>{error || "This game report may not have detailed data saved."}</p>
          <Link href="/dashboard" className="btn btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const players = result.results.players || [];
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const breakdown = result.results.question_breakdown || [];
  const hasBreakdown = breakdown.length > 0;
  const totalQuestions = result.results.question_count || breakdown.length;
  const avgScore = players.length > 0 ? Math.round(players.reduce((s, p) => s + p.score, 0) / players.length) : 0;
  const avgAccuracy = hasBreakdown
    ? Math.round(breakdown.reduce((s, q) => s + q.accuracy_pct, 0) / breakdown.length)
    : 0;
  const avgResponseTime = hasBreakdown
    ? Math.round(breakdown.reduce((s, q) => s + q.avg_response_time_ms, 0) / breakdown.length / 1000 * 10) / 10
    : 0;

  // Per-player accuracy from breakdown
  const playerAccuracy: Record<string, { correct: number; total: number }> = {};
  if (hasBreakdown) {
    for (const q of breakdown) {
      for (const r of q.responses) {
        if (!playerAccuracy[r.player_id]) playerAccuracy[r.player_id] = { correct: 0, total: 0 };
        playerAccuracy[r.player_id].total++;
        if (r.is_correct) playerAccuracy[r.player_id].correct++;
      }
    }
  }

  // CSV export
  function exportCSV() {
    if (!hasBreakdown) return;
    const rows = [["Player", "Question", "Answer", "Correct", "Points", "Response Time (ms)"]];
    for (const q of breakdown) {
      for (const r of q.responses) {
        rows.push([r.nickname, q.text, r.answer_id, r.is_correct ? "Yes" : "No", String(r.points_awarded), String(r.response_time_ms)]);
      }
    }
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quizworld-report-${pin}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const finishedDate = new Date(result.finished_at).toLocaleString();

  return (
    <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem", maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800 }}>📊 Game Report</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>PIN: {pin} · {finishedDate}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {hasBreakdown && (
            <button onClick={exportCSV} className="btn btn-secondary btn-compact">📥 Export CSV</button>
          )}
          <Link href="/dashboard" className="btn btn-secondary btn-compact">← Dashboard</Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--line)", paddingBottom: "0.5rem" }}>
        {(["overview", "questions", "players"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "0.5rem 1rem", fontSize: "0.8125rem", fontWeight: 700, borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
              border: "none", cursor: "pointer", textTransform: "capitalize",
              background: activeTab === tab ? "var(--accent)" : "transparent",
              color: activeTab === tab ? "#fff" : "var(--muted)",
            }}
          >{tab === "overview" ? "📈 Overview" : tab === "questions" ? "❓ By Question" : "👥 Players"}</button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <StatCard label="Players" value={players.length} />
            <StatCard label="Questions" value={totalQuestions} />
            <StatCard label="Avg Score" value={avgScore.toLocaleString()} color="var(--accent)" />
            {hasBreakdown && <StatCard label="Avg Accuracy" value={`${avgAccuracy}%`} color={avgAccuracy >= 70 ? "var(--success)" : "var(--primary)"} />}
            {hasBreakdown && <StatCard label="Avg Response" value={`${avgResponseTime}s`} color="var(--secondary)" />}
          </div>

          {/* Top 3 Podium */}
          {sortedPlayers.length >= 1 && (
            <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
              <h3 style={{ fontWeight: 800, marginBottom: "1rem" }}>🏆 Top Players</h3>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: "1.5rem", flexWrap: "wrap" }}>
                {sortedPlayers.slice(0, 3).map((player, i) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  const heights = [120, 95, 75];
                  const order = [1, 0, 2];
                  const idx = order[i] ?? i;
                  const p = sortedPlayers[idx];
                  if (!p) return null;
                  const acc = playerAccuracy[p.id];
                  return (
                    <div key={p.id} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.5rem" }}>{medals[idx]}</div>
                      <div style={{ fontSize: "2rem" }}>{p.avatar || "🎮"}</div>
                      <div style={{ fontWeight: 800, fontSize: "0.875rem" }}>{p.nickname}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{p.score.toLocaleString()} pts</div>
                      {acc && <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{acc.correct}/{acc.total} correct</div>}
                      <div style={{ height: heights[idx], width: 70, background: idx === 0 ? "var(--accent)" : "var(--line)", borderRadius: "8px 8px 0 0", marginTop: "0.5rem", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0.4rem" }}>
                        <span style={{ fontWeight: 900, color: idx === 0 ? "#fff" : "var(--ink)", fontSize: "0.75rem" }}>{p.score.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Difficulty distribution */}
          {hasBreakdown && (
            <div className="card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontWeight: 800, marginBottom: "0.75rem" }}>Question Difficulty</h3>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {["easy", "medium", "hard"].map(d => {
                  const count = breakdown.filter(q => q.difficulty === d).length;
                  return (
                    <div key={d} style={{ flex: 1, minWidth: 100, padding: "0.75rem", borderRadius: "var(--radius-lg)", background: d === "easy" ? "var(--success-light)" : d === "hard" ? "var(--primary-light)" : "rgba(245,158,11,0.1)", textAlign: "center" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 900, color: d === "easy" ? "var(--success)" : d === "hard" ? "var(--primary)" : "#f59e0b" }}>{count}</div>
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "capitalize", color: "var(--muted)" }}>{d}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Questions Tab */}
      {activeTab === "questions" && (
        <>
          {!hasBreakdown ? (
            <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
              <p style={{ color: "var(--muted)" }}>Detailed question data is not available for this game. Play a new game to see per-question analytics.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "1rem" }}>
              {breakdown.map((q, i) => (
                <div key={q.question_id} className="card" style={{ padding: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--muted)", marginBottom: "0.25rem" }}>Q{i + 1}</div>
                      <div style={{ fontWeight: 700 }}>{q.text}</div>
                    </div>
                    <DifficultyBadge difficulty={q.difficulty} />
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>
                    <span>✅ {q.correct_count}/{q.total_responses} correct</span>
                    <span>⏱ Avg {Math.round(q.avg_response_time_ms / 1000 * 10) / 10}s</span>
                    <span>⭐ {q.points} pts</span>
                  </div>

                  {/* Answer distribution */}
                  <div style={{ display: "grid", gap: "0.375rem" }}>
                    {q.distribution.map((d, di) => (
                      <div key={d.answer_id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.6rem", borderRadius: "var(--radius-md)", background: d.is_correct ? "var(--accent-light)" : "var(--bg)", border: d.is_correct ? "1px solid var(--accent)" : "1px solid transparent" }}>
                        <span style={{ fontWeight: 800, fontSize: "0.75rem", color: d.is_correct ? "var(--accent)" : "var(--muted)", width: 20 }}>{String.fromCharCode(65 + di)}</span>
                        <span style={{ flex: 1, fontSize: "0.8125rem", fontWeight: 600 }}>{d.text}</span>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", minWidth: 30, textAlign: "right" }}>{d.percentage}%</span>
                        <div style={{ width: 60, height: 6, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${d.percentage}%`, borderRadius: 3, background: d.is_correct ? "var(--accent)" : "var(--muted)" }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {q.correct_answer_text && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--success)", fontWeight: 700 }}>
                      ✅ Correct: {q.correct_answer_text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Players Tab */}
      {activeTab === "players" && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {sortedPlayers.map((player, i) => {
            const acc = playerAccuracy[player.id];
            return (
              <div key={player.id} className="card" style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontWeight: 900, fontSize: "1.125rem", color: i < 3 ? "var(--accent)" : "var(--muted)", width: 28, textAlign: "center" }}>
                  {i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`}
                </span>
                <span style={{ fontSize: "1.5rem" }}>{player.avatar || "🎮"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{player.nickname}</div>
                  {acc && <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{acc.correct}/{acc.total} correct ({Math.round(acc.correct / acc.total * 100)}%)</div>}
                </div>
                <span style={{ fontWeight: 900, fontSize: "1.125rem", color: "var(--accent)" }}>{player.score.toLocaleString()} pts</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

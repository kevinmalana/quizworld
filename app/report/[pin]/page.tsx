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
    <div className="report-stat-card">
      <div className="report-stat-label">{label}</div>
      <div className="font-display report-stat-value" style={{ color }}>{value}</div>
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const cls = difficulty === "easy" ? "report-difficulty-badge report-difficulty-badge--easy"
    : difficulty === "hard" ? "report-difficulty-badge report-difficulty-badge--hard"
    : "report-difficulty-badge report-difficulty-badge--medium";
  const icon = difficulty === "easy" ? "🟢" : difficulty === "hard" ? "🔴" : "🟡";
  return <span className={cls}>{icon} {difficulty}</span>;
}

function QualityScore({ q }: { q: QuestionBreakdown }) {
  if (q.total_responses < 3) return <span className="report-quality--insufficient">Need 3+ players</span>;
  const accuracy = q.accuracy_pct;
  const avgTimeSec = q.avg_response_time_ms / 1000;
  const timeLimit = q.time_limit;
  const timePressure = avgTimeSec / timeLimit;
  let score = 50;
  if (accuracy >= 40 && accuracy <= 85) score += 25;
  else if (accuracy < 40) score -= 15;
  if (timePressure > 0.3 && timePressure < 0.9) score += 15;
  else if (timePressure <= 0.3) score -= 10;
  const spread = Math.max(...q.distribution.map(d => d.percentage)) - Math.min(...q.distribution.map(d => d.percentage));
  if (spread < 60) score += 10;
  score = Math.max(0, Math.min(100, score));
  const cls = score >= 75 ? "report-quality report-quality--good" : score >= 50 ? "report-quality report-quality--ok" : "report-quality report-quality--bad";
  const label = score >= 75 ? "Great" : score >= 50 ? "OK" : "Needs work";
  const icon = score >= 75 ? "✅" : score >= 50 ? "⚠️" : "❌";
  return <span className={cls} title={`Quality: ${score}/100`}>{icon} {label}</span>;
}

function AccuracyBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "var(--success)" : pct >= 50 ? "#f59e0b" : "var(--primary)";
  return (
    <div className="report-accuracy-bar">
      <div className="report-accuracy-track">
        <div className="report-accuracy-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="report-accuracy-label">{pct}%</span>
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
    return <div className="container report-status">Loading report...</div>;
  }

  if (error || !result) {
    return (
      <div className="container report-status">
        <div className="card report-error-card">
          <div className="report-error-icon">📊</div>
          <h2 className="report-error-title">Report Not Found</h2>
          <p className="report-error-text">{error || "This game report may not have detailed data saved."}</p>
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
    <div className="container report-shell">
      <div className="report-header">
        <div>
          <h1 className="font-display report-header-title">📊 Game Report</h1>
          <p className="report-header-meta">PIN: {pin} · {finishedDate}</p>
        </div>
        <div className="report-header-actions">
          {hasBreakdown && (
            <button onClick={exportCSV} className="btn btn-secondary btn-compact">📥 Export CSV</button>
          )}
          <Link href="/dashboard" className="btn btn-secondary btn-compact">← Dashboard</Link>
        </div>
      </div>

      <div className="report-tabs">
        {(["overview", "questions", "players"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? "report-tab is-active" : "report-tab"}
          >{tab === "overview" ? "📈 Overview" : tab === "questions" ? "❓ By Question" : "👥 Players"}</button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          <div className="report-stats-grid">
            <StatCard label="Players" value={players.length} />
            <StatCard label="Questions" value={totalQuestions} />
            <StatCard label="Avg Score" value={avgScore.toLocaleString()} color="var(--accent)" />
            {hasBreakdown && <StatCard label="Avg Accuracy" value={`${avgAccuracy}%`} color={avgAccuracy >= 70 ? "var(--success)" : "var(--primary)"} />}
            {hasBreakdown && <StatCard label="Avg Response" value={`${avgResponseTime}s`} color="var(--secondary)" />}
          </div>

          {sortedPlayers.length >= 1 && (
            <div className="card report-podium">
              <h3 className="report-podium-title">🏆 Top Players</h3>
              <div className="report-podium-row">
                {sortedPlayers.slice(0, 3).map((player, i) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  const heights = [120, 95, 75];
                  const order = [1, 0, 2];
                  const idx = order[i] ?? i;
                  const p = sortedPlayers[idx];
                  if (!p) return null;
                  const acc = playerAccuracy[p.id];
                  return (
                    <div key={p.id} className="report-podium-player">
                      <div className="report-podium-medal">{medals[idx]}</div>
                      <div className="report-podium-avatar">{p.avatar || "🎮"}</div>
                      <div className="report-podium-name">{p.nickname}</div>
                      <div className="report-podium-score">{p.score.toLocaleString()} pts</div>
                      {acc && <div className="report-podium-accuracy">{acc.correct}/{acc.total} correct</div>}
                      <div className="report-podium-bar" style={{ height: heights[idx], background: idx === 0 ? "var(--accent)" : "var(--line)" }}>
                        <span className="report-podium-bar-value" style={{ color: idx === 0 ? "#fff" : "var(--ink)" }}>{p.score.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hasBreakdown && (
            <div className="card report-difficulty-card">
              <h3 className="report-difficulty-title">Question Difficulty</h3>
              <div className="report-difficulty-row">
                {(["easy", "medium", "hard"] as const).map(d => {
                  const count = breakdown.filter(q => q.difficulty === d).length;
                  const bg = d === "easy" ? "var(--success-light)" : d === "hard" ? "var(--primary-light)" : "rgba(245,158,11,0.1)";
                  const color = d === "easy" ? "var(--success)" : d === "hard" ? "var(--primary)" : "#f59e0b";
                  return (
                    <div key={d} className="report-difficulty-item" style={{ background: bg }}>
                      <div className="report-difficulty-count" style={{ color }}>{count}</div>
                      <div className="report-difficulty-label">{d}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "questions" && (
        <>
          {!hasBreakdown ? (
            <div className="card report-empty-card">
              <p style={{ color: "var(--muted)" }}>Detailed question data is not available for this game. Play a new game to see per-question analytics.</p>
            </div>
          ) : (
            <div className="report-question-list">
              {breakdown.map((q, i) => (
                <div key={q.question_id} className="card report-question-card">
                  <div className="report-question-header">
                    <div className="report-question-text">
                      <div className="report-question-index">Q{i + 1}</div>
                      <div style={{ fontWeight: 700 }}>{q.text}</div>
                    </div>
                    <div className="report-question-badges">
                      <QualityScore q={q} />
                      <DifficultyBadge difficulty={q.difficulty} />
                    </div>
                  </div>

                  <div className="report-question-stats">
                    <span>✅ {q.correct_count}/{q.total_responses} correct</span>
                    <span>⏱ Avg {Math.round(q.avg_response_time_ms / 1000 * 10) / 10}s</span>
                    <span>⭐ {q.points} pts</span>
                  </div>

                  <div className="report-answer-grid">
                    {q.distribution.map((d, di) => (
                      <div key={d.answer_id} className={d.is_correct ? "report-answer-row is-correct" : "report-answer-row"}>
                        <span className="report-answer-letter">{String.fromCharCode(65 + di)}</span>
                        <span className="report-answer-text">{d.text}</span>
                        <span className="report-answer-pct">{d.percentage}%</span>
                        <div className="report-answer-bar">
                          <div className="report-answer-bar-fill" style={{ width: `${d.percentage}%`, background: d.is_correct ? "var(--accent)" : "var(--muted)" }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {q.correct_answer_text && (
                    <div className="report-correct-label">✅ Correct: {q.correct_answer_text}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "players" && (
        <div className="report-player-list">
          {sortedPlayers.map((player, i) => {
            const acc = playerAccuracy[player.id];
            return (
              <div key={player.id} className="card report-player-card">
                <span className={i < 3 ? "report-player-rank is-top" : "report-player-rank"}>
                  {i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`}
                </span>
                <span className="report-player-avatar">{player.avatar || "🎮"}</span>
                <div className="report-player-info">
                  <div className="report-player-name">{player.nickname}</div>
                  {acc && <div className="report-player-accuracy">{acc.correct}/{acc.total} correct ({Math.round(acc.correct / acc.total * 100)}%)</div>}
                </div>
                <span className="report-player-score">{player.score.toLocaleString()} pts</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

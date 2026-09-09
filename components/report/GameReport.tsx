"use client";
import Link from "next/link";
import { useState } from "react";
import { buildReportCSV, getReportAnalytics, questionScoring, type GameResult, type QuestionBreakdown } from "@/lib/report-analytics";

function StatCard({ label, value, color = "var(--accent)" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="report-stat-card">
      <div className="report-stat-label">{label}</div>
      <div className="font-display report-stat-value" style={{"--val-color": color} as React.CSSProperties}>{value}</div>
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string | null }) {
  if (!difficulty) return null;
  const cls = difficulty === "easy" ? "report-difficulty-badge report-difficulty-badge--easy"
    : difficulty === "hard" ? "report-difficulty-badge report-difficulty-badge--hard"
    : "report-difficulty-badge report-difficulty-badge--medium";
  const icon = difficulty === "easy" ? "🟢" : difficulty === "hard" ? "🔴" : "🟡";
  return <span className={cls}>{icon} {difficulty}</span>;
}

function QualityScore({ q }: { q: QuestionBreakdown }) {
  if (questionScoring(q) !== "scored" || q.accuracy_pct === null) return null;
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
        <div className="report-accuracy-fill" style={{"--fill-width": `${pct}%`, "--fill-color": color} as React.CSSProperties} />
      </div>
      <span className="report-accuracy-label">{pct}%</span>
    </div>
  );
}

export function GameReport({ result, pin, initialTab = "overview" }: { result: GameResult; pin: string; initialTab?: "overview" | "questions" | "players" }) {
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "players">(initialTab);
  const players = result.results.players || [];
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const breakdown = result.results.question_breakdown || [];
  const hasBreakdown = breakdown.length > 0;
  const totalQuestions = result.results.question_count || breakdown.length;
  const gameMode = result.results.game_mode ?? "classic";
  const eliminated = result.results.eliminated ?? [];
  const teams = result.results.teams ?? {};
  const teamAssignments = result.results.team_assignments ?? {};
  const teamList = Object.values(teams).sort((a, b) => b.score - a.score);
  const avgScore = players.length > 0 ? Math.round(players.reduce((s, p) => s + p.score, 0) / players.length) : 0;
  const { avgAccuracy, playerAccuracy, scored, unknownCount } = getReportAnalytics(breakdown);
  const avgResponseTime = hasBreakdown
    ? Math.round(breakdown.reduce((s, q) => s + q.avg_response_time_ms, 0) / breakdown.length / 1000 * 10) / 10
    : 0;

  function exportCSV() {
    if (!hasBreakdown) return;
    const csv = buildReportCSV(breakdown);
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
          <p className="report-header-meta">PIN: {pin} · {finishedDate}
            {gameMode !== "classic" && (
              <span className={`report-mode-badge report-mode-badge--${gameMode}`}>
                {gameMode === "survival" ? "💀 Survival" : "👥 Team Battle"}
              </span>
            )}
          </p>
        </div>
        <div className="report-header-actions">
          {hasBreakdown && (
            <button onClick={exportCSV} className="btn btn-secondary btn-compact">📥 Export CSV</button>
          )}
          <Link href="/dashboard" className="btn btn-secondary btn-compact">← Dashboard</Link>
        </div>
      </div>

      {unknownCount > 0 && <p role="note">Historical question types are unavailable for {unknownCount} question(s). Their accuracy, difficulty and correctness are unknown and excluded below; stored scores are unchanged.</p>}
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
            {avgAccuracy !== null && <StatCard label="Avg Accuracy" value={`${avgAccuracy}%`} color={avgAccuracy >= 70 ? "var(--success)" : "var(--primary)"} />}
            {hasBreakdown && <StatCard label="Avg Response" value={`${avgResponseTime}s`} color="var(--secondary)" />}
            {gameMode === "survival" && <StatCard label="Survived" value={`${players.length - eliminated.length}/${players.length}`} color="#22c55e" />}
          </div>

          {/* Survival summary */}
          {gameMode === "survival" && eliminated.length > 0 && (
            <div className="card report-mode-card">
              <h3 className="report-mode-card-title">💀 Survival Results</h3>
              <div className="report-mode-card-body">
                <div className="report-survival-survived">
                  <strong>💪 Survivors ({players.length - eliminated.length}):</strong>
                  {sortedPlayers.filter(p => !eliminated.includes(p.id)).map(p => (
                    <span key={p.id} className="report-survival-player report-survival-player--alive">{p.avatar || "🎮"} {p.nickname}</span>
                  ))}
                </div>
                <div className="report-survival-eliminated">
                  <strong>💨 Eliminated ({eliminated.length}):</strong>
                  {sortedPlayers.filter(p => eliminated.includes(p.id)).map(p => (
                    <span key={p.id} className="report-survival-player report-survival-player--out">{p.avatar || "🎮"} {p.nickname}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Team Battle summary */}
          {gameMode === "team" && teamList.length > 0 && (
            <div className="card report-mode-card">
              <h3 className="report-mode-card-title">👥 Team Results</h3>
              <div className="report-team-list">
                {teamList.map((team, i) => {
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
                  const teamPlayers = players.filter(p => teamAssignments[p.id] === team.id);
                  return (
                    <div key={team.id} className="report-team-row" style={{ borderColor: team.color }}>
                      <div className="report-team-row-header">
                        <span>{medal} {team.emoji} <strong style={{ color: team.color }}>{team.name}</strong></span>
                        <span className="report-team-score" style={{ color: team.color }}>{team.score.toLocaleString()} pts</span>
                      </div>
                      <div className="report-team-members">
                        {teamPlayers.map(p => <span key={p.id} className="report-team-member">{p.avatar || "🎮"} {p.nickname}</span>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                      <div className={idx === 0 ? "report-podium-bar is-gold" : "report-podium-bar"} style={{"--bar-height": `${heights[idx]}px`} as React.CSSProperties}>
                        <span className={idx === 0 ? "report-podium-bar-value is-gold" : "report-podium-bar-value"}>{p.score.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {scored.length > 0 && (
            <div className="card report-difficulty-card">
              <h3 className="report-difficulty-title">Question Difficulty</h3>
              <div className="report-difficulty-row">
                {(["easy", "medium", "hard"] as const).map(d => {
                  const count = scored.filter(q => q.difficulty === d).length;
                  const bg = d === "easy" ? "var(--success-light)" : d === "hard" ? "var(--primary-light)" : "rgba(245,158,11,0.1)";
                  const color = d === "easy" ? "var(--success)" : d === "hard" ? "var(--primary)" : "#f59e0b";
                  return (
                    <div key={d} className="report-difficulty-item" style={{"--diff-bg": bg} as React.CSSProperties}>
                      <div className="report-difficulty-count" style={{"--diff-color": color} as React.CSSProperties}>{count}</div>
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
              <p className="text-muted">Detailed question data is not available for this game. Play a new game to see per-question analytics.</p>
            </div>
          ) : (
            <div className="report-question-list">
              {breakdown.map((q, i) => (
                <div key={q.question_id} className="card report-question-card">
                  <div className="report-question-header">
                    <div className="report-question-text">
                      <div className="report-question-index">Q{i + 1}</div>
                      <div className="font-700">{q.text}</div>
                    </div>
                    <div className="report-question-badges">
                      <QualityScore q={q} />
                      {questionScoring(q) === "scored" ? <DifficultyBadge difficulty={q.difficulty} /> : <span>{questionScoring(q) === "unscored" ? (q.question_type === "poll" ? "Poll — unscored" : "Unscored") : "Scoring unknown (legacy)"}</span>}
                    </div>
                  </div>

                  <div className="report-question-stats">
                    {questionScoring(q) === "scored" && q.correct_count !== null && <span>✅ {q.correct_count}/{q.total_responses} correct</span>}
                    <span>⏱ Avg {Math.round(q.avg_response_time_ms / 1000 * 10) / 10}s</span>
                    <span>⭐ {q.points} pts</span>
                  </div>

                  <div className="report-answer-grid">
                    {q.distribution.map((d, di) => (
                      <div key={d.answer_id} className={questionScoring(q) === "scored" && d.is_correct ? "report-answer-row is-correct" : "report-answer-row"}>
                        <span className="report-answer-letter">{String.fromCharCode(65 + di)}</span>
                        <span className="report-answer-text">{d.text}</span>
                        <span className="report-answer-pct">{d.percentage}%</span>
                        <div className="report-answer-bar">
                          <div className={questionScoring(q) === "scored" && d.is_correct ? "report-answer-bar-fill is-correct" : "report-answer-bar-fill"} style={{"--fill-width": `${d.percentage}%`} as React.CSSProperties} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {questionScoring(q) === "scored" && q.correct_answer_text && (
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
                  {acc && acc.total > 0 && <div className="report-player-accuracy">{acc.correct}/{acc.total} correct ({Math.round(acc.correct / acc.total * 100)}%)</div>}
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

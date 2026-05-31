import Link from "next/link";
import { QrCode } from "@/components/shared/qr-code";
import { extractYouTubeId } from "@/lib/media/youtube";
import type { CurrentAnswer, GameAnswer, GamePlayer, GameQuestion } from "@/lib/game/session-normalizers";

// ─── Types ───────────────────────────────────────────────────────────────────

type GameAnswerWithMedia = GameAnswer & { image_url?: string | null };
type GameSessionData = { quiz_id?: string };

// ─── GameNotice ───────────────────────────────────────────────────────────────

export function GameNotice({ notice, maxWidth = 720 }: { notice: string | null; maxWidth?: number }) {
  if (!notice) return null;
  return (
    <div className="card game-notice" style={{ maxWidth }}>
      {notice}
    </div>
  );
}

// ─── GameProgressBar ──────────────────────────────────────────────────────────

export function GameProgressBar({
  currentIndex,
  totalQuestions,
  compact = false,
}: {
  currentIndex: number;
  totalQuestions: number;
  compact?: boolean;
}) {
  const pct = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;
  return (
    <div className="game-progress-wrapper">
      {!compact && (
        <div className="game-progress-meta">
          <span>Question {currentIndex + 1} of {totalQuestions}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className="game-progress-track">
        <div className="game-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── QuestionMedia ────────────────────────────────────────────────────────────

export function QuestionMedia({
  question,
  maxHeight = 240,
  margin = "1rem",
}: {
  question: GameQuestion;
  maxHeight?: number;
  margin?: string;
}) {
  const q = question as GameQuestion & { image_url?: string; video_url?: string };
  const youtubeId = q.video_url ? extractYouTubeId(q.video_url) : null;

  return (
    <>
      {q.image_url && (
        <img
          src={q.image_url}
          alt=""
          className="game-question-img"
          style={{ maxHeight, marginTop: margin, marginBottom: margin === "0" ? 0 : undefined }}
        />
      )}
      {q.video_url && youtubeId && (
        <div
          className="game-video-wrapper"
          style={{ marginTop: margin, marginBottom: margin === "0" ? 0 : undefined }}
        >
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            className="game-video-iframe"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </>
  );
}

// ─── WaitingLobbyPanel ────────────────────────────────────────────────────────

export function WaitingLobbyPanel({
  pin,
  joinUrl,
  notice,
  players,
  readyPlayers,
  readyCount,
  isHost,
  currentPlayer,
  playerSessionReady,
  amReady,
  onReady,
  onStart,
  gameMode = "classic",
}: {
  pin: string;
  joinUrl: string;
  notice: string | null;
  players: GamePlayer[];
  readyPlayers: Set<string>;
  readyCount: number;
  isHost: boolean;
  currentPlayer: GamePlayer | null;
  playerSessionReady: boolean;
  amReady: boolean;
  onReady: () => void;
  onStart: () => void;
  gameMode?: string;
}) {
  return (
    <div className="container game-lobby">
      <GameNotice notice={notice} maxWidth={640} />
      <div className="card game-lobby-card">
        <div className="game-lobby-icon">🎮</div>
        <h1 className="font-display game-lobby-title">{isHost ? "Waiting for players…" : "Waiting for host…"}</h1>

        <div className="game-lobby-pin-area lobby-pin-qr">
          <div>
            <div className="game-lobby-pin-label">Game PIN</div>
            <div className="game-lobby-pin-value">{pin}</div>
          </div>
          <div className="game-lobby-divider" />
          <div>
            <QrCode value={joinUrl} size={120} label="Scan to join" className="qr-code qr-code-sm" />
            <div className="game-lobby-qr-label">Scan to join</div>
          </div>
        </div>

        {players.length > 0 && (
          <>
            {isHost && readyCount > 0 && (
              <p className="game-lobby-ready-count">✅ {readyCount}/{players.length} players ready</p>
            )}
            <div className="game-lobby-players">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`game-lobby-player${readyPlayers.has(player.id) ? " is-ready" : ""}`}
                >
                  <span>{player.avatar || "🎮"}</span>
                  <span className="game-lobby-player-name">{player.nickname}</span>
                  {readyPlayers.has(player.id) && (
                    <span className="game-lobby-ready-badge">✅ Ready</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {!isHost && currentPlayer && !amReady && (
          <button onClick={onReady} className="btn btn-primary" style={{ width: "100%", marginBottom: "0.75rem" }}>
            Ready ✅
          </button>
        )}
        {!isHost && currentPlayer && amReady && (
          <div className="game-lobby-you-ready">✅ You&apos;re ready!</div>
        )}
        {isHost && (
          <>
            {gameMode === "survival" && players.length < 2 && players.length > 0 && (
              <div className="game-lobby-warning">⚠️ Survival works best with 3+ players</div>
            )}
            {gameMode === "team" && players.length < 2 && players.length > 0 && (
              <div className="game-lobby-warning">⚠️ Team Battle needs at least 2 players</div>
            )}
            <button
              onClick={onStart}
              disabled={players.length === 0 || (gameMode === "team" && players.length < 2)}
              className="btn btn-primary btn-lg"
              style={{ width: "100%" }}
            >
              {players.length === 0 ? "Waiting for players..."
                : gameMode === "team" && players.length < 2 ? "Need 2+ players for Team Battle"
                : "Start Game 🚀"}
            </button>
          </>
        )}
        {!isHost && !currentPlayer && playerSessionReady && (
          <Link href={`/join?pin=${pin}`} className="btn btn-secondary">
            Join this game
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── ActiveHostDashboard ──────────────────────────────────────────────────────

export function ActiveHostDashboard({
  currentAnswers,
  players,
  currentQuestion,
  timeLeft,
  teams = {},
  teamAssignments = {},
  gameMode = "classic",
}: {
  currentAnswers: CurrentAnswer[];
  players: GamePlayer[];
  currentQuestion: GameQuestion;
  timeLeft: number;
  teams?: Record<string, Team>;
  teamAssignments?: Record<string, string>;
  gameMode?: string;
}) {
  const answered = currentAnswers.length;
  const correct = currentAnswers.filter((a) => a.is_correct).length;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  return (
    <div className="card game-host-dashboard">
      <div className="game-host-metrics">
        <HostMetric value={`${answered}/${players.length}`} label="Answered" color="var(--accent)" />
        <HostMetric
          value={`${accuracy}%`}
          label="Accuracy"
          color={answered > 0 && accuracy >= 70 ? "var(--success)" : "var(--primary)"}
        />
        <HostMetric
          value={`${timeLeft}s`}
          label="Time Left"
          color={timeLeft <= 5 ? "var(--primary)" : "var(--ink)"}
        />
      </div>

      {/* Team mode: show live team scores alongside answer bars */}
      {gameMode === "team" && Object.keys(teams).length > 0 && (
        <TeamScoreBar teams={teams} myTeamId={null} />
      )}

      {answered > 0 && currentQuestion.answers && (
        <div
          className="game-host-bars"
          style={{ gridTemplateColumns: `repeat(${currentQuestion.answers.length}, 1fr)` }}
        >
          {currentQuestion.answers.map((answer, i) => {
            const count = currentAnswers.filter((r) => r.answer_id === answer.id).length;
            const pct = Math.round((count / answered) * 100);
            return (
              <div key={answer.id} className="game-host-bar-col">
                <div
                  className="game-host-bar-letter"
                  style={{ color: answer.is_correct ? "var(--accent)" : "var(--muted)" }}
                >
                  {String.fromCharCode(65 + i)}
                </div>
                <div className="game-host-bar-track">
                  <div
                    className="game-host-bar-fill"
                    style={{
                      height: `${pct}%`,
                      background: answer.is_correct ? "var(--accent)" : "var(--muted)",
                    }}
                  />
                </div>
                <div className="game-host-bar-pct">{pct}%</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HostMetric({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="game-host-metric">
      <div className="game-host-metric-value" style={{ color }}>{value}</div>
      <div className="game-host-metric-label">{label}</div>
    </div>
  );
}

// ─── SpectatorPanel ───────────────────────────────────────────────────────────

export function SpectatorPanel() {
  return (
    <div className="card game-spectator">
      <p className="game-spectator-title">Spectator view</p>
      <p className="game-spectator-desc">
        The game is already in progress.<br />Watch along or join the next session.
      </p>
      <Link href="/" className="btn btn-secondary">Back to Home</Link>
    </div>
  );
}

// ─── PlayerAnswerGrid ─────────────────────────────────────────────────────────

export function PlayerAnswerGrid({
  currentQuestion,
  selectedAnswer,
  submittingAnswer,
  timeLeft,
  onSubmit,
  myTeam,
}: {
  currentQuestion: GameQuestion;
  selectedAnswer: string | null;
  submittingAnswer: boolean;
  timeLeft: number;
  onSubmit: (answer: { id: string }) => void;
  myTeam?: { name: string; color: string; emoji: string } | null;
}) {
  const locked = selectedAnswer !== null || submittingAnswer || timeLeft <= 0;

  return (
    <div className="game-answer-grid">
      {myTeam && (
        <div className="game-my-team-badge" style={{ borderColor: myTeam.color, color: myTeam.color, background: `${myTeam.color}15` }}>
          {myTeam.emoji} Your team: <strong>{myTeam.name}</strong>
        </div>
      )}
      {currentQuestion.answers?.map((answer, index) => {
        const a = answer as GameAnswerWithMedia;
        const selected = selectedAnswer === answer.id;
        return (
          <button
            key={answer.id}
            onClick={() => onSubmit(answer)}
            disabled={locked}
            className={`game-answer-btn${selected ? " is-selected" : ""}`}
          >
            <span className="game-answer-badge">{String.fromCharCode(65 + index)}</span>
            {a.image_url && <img src={a.image_url} alt="" className="game-answer-img" />}
            {answer.text}
          </button>
        );
      })}
    </div>
  );
}

// ─── AnswerRevealList ─────────────────────────────────────────────────────────

export function AnswerRevealList({
  answerCounts,
}: {
  answerCounts: (GameAnswer & { count: number; image_url?: string | null })[];
}) {
  return (
    <div className="game-reveal-list">
      {answerCounts.map((answer, index) => (
        <div key={answer.id} className={`game-reveal-item${answer.is_correct ? " is-correct" : ""}`}>
          <span className="game-reveal-label">
            {answer.is_correct ? "✅" : `${String.fromCharCode(65 + index)}.`} {answer.text}
            {answer.image_url && <img src={answer.image_url} alt="" className="game-reveal-img" />}
          </span>
          <span className="game-reveal-votes">{answer.count} vote{answer.count !== 1 ? "s" : ""}</span>
        </div>
      ))}
    </div>
  );
}

// ─── LeaderboardList ──────────────────────────────────────────────────────────

export function LeaderboardList({
  leaderboard,
  playerStreaks,
  playerAchievements,
  playerCorrectCounts,
  totalQuestions,
}: {
  leaderboard: GamePlayer[];
  playerStreaks: Record<string, number>;
  playerAchievements: Record<string, { label: string; emoji: string }[]>;
  playerCorrectCounts: Record<string, number>;
  totalQuestions: number;
}) {
  return (
    <div>
      <h3 className="game-leaderboard-title">Leaderboard</h3>
      <div className="game-leaderboard-list">
        {leaderboard.map((player, index) => (
          <div key={player.id} className="game-leaderboard-row">
            <span className="game-leaderboard-name">
              {index + 1}. {player.avatar || "🎮"} {player.nickname}
              {(playerStreaks[player.id] ?? 0) >= 2 && (
                <span className="game-leaderboard-streak">🔥{playerStreaks[player.id]}</span>
              )}
              {(playerAchievements[player.id] ?? []).map((badge, bi) => (
                <span key={bi} className="game-leaderboard-badge" title={badge.label}>
                  {badge.emoji}
                </span>
              ))}
            </span>
            <span className="game-leaderboard-score">
              {playerCorrectCounts[player.id] ?? 0}/{totalQuestions} ✓ · {(player.score ?? 0).toLocaleString()} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GameFinishedPanel ────────────────────────────────────────────────────────

// Podium display order: 2nd place left, 1st place centre, 3rd place right
const PODIUM_ORDER = [1, 0, 2] as const;
const PODIUM_MEDALS = ["🥇", "🥈", "🥉"] as const;
const PODIUM_HEIGHTS = [140, 110, 90] as const;

export function GameFinishedPanel({
  notice,
  pin,
  leaderboard,
  isHost,
  session,
  playerAchievements,
  playerCorrectCounts,
  totalQuestions,
  aiSummary,
  aiSummaryLoading,
  onGenerateAiSummary,
  gameMode = "classic",
  teams = {},
  teamAssignments = {},
  eliminated = [],
}: {
  notice: string | null;
  pin: string;
  leaderboard: GamePlayer[];
  isHost: boolean;
  session: Record<string, unknown> | null;
  playerAchievements: Record<string, { label: string; emoji: string }[]>;
  playerCorrectCounts: Record<string, number>;
  totalQuestions: number;
  aiSummary: string | null;
  aiSummaryLoading: boolean;
  onGenerateAiSummary: () => void;
  gameMode?: string;
  teams?: Record<string, Team>;
  teamAssignments?: Record<string, string>;
  eliminated?: string[];
}) {
  const quizId = (session as GameSessionData)?.quiz_id;

  // Survival: winner = last non-eliminated player (highest scorer among alive)
  const survivalWinner = gameMode === "survival"
    ? leaderboard.find(p => !eliminated.includes(p.id)) ?? leaderboard[0]
    : null;

  // Team: winning team = highest score
  const teamList = Object.values(teams).sort((a, b) => b.score - a.score);
  const winningTeam = teamList[0] ?? null;

  return (
    <div className="container game-finished">
      <GameNotice notice={notice} maxWidth={640} />
      <div className="card game-finished-card">

        {/* Mode-specific header */}
        {gameMode === "survival" ? (
          <>
            <div className="game-finished-icon">💀</div>
            <h1 className="font-display game-finished-title">Survival Complete!</h1>
            {survivalWinner ? (
              <div className="survival-winner-banner">
                <div className="survival-winner-avatar">{survivalWinner.avatar || "🎮"}</div>
                <div>
                  <div className="survival-winner-label">Last Player Standing</div>
                  <div className="survival-winner-name">{survivalWinner.nickname}</div>
                  <div className="survival-winner-score">{(survivalWinner.score ?? 0).toLocaleString()} pts</div>
                </div>
              </div>
            ) : null}
          </>
        ) : gameMode === "team" ? (
          <>
            <div className="game-finished-icon">{winningTeam?.emoji ?? "🏆"}</div>
            <h1 className="font-display game-finished-title">Team Battle Complete!</h1>
            {winningTeam && (
              <div className="team-winner-banner" style={{ borderColor: winningTeam.color }}>
                <div className="team-winner-emoji">{winningTeam.emoji}</div>
                <div>
                  <div className="team-winner-label">🏆 Winning Team</div>
                  <div className="team-winner-name" style={{ color: winningTeam.color }}>{winningTeam.name}</div>
                  <div className="team-winner-score">{winningTeam.score.toLocaleString()} pts</div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="game-finished-icon">🏆</div>
            <h1 className="font-display game-finished-title">Game Finished</h1>
            <p className="game-finished-sub">Final leaderboard for PIN {pin}</p>
          </>
        )}

        {/* Classic + Survival: individual podium */}
        {gameMode !== "team" && leaderboard.length >= 1 && (
          <div className="game-podium">
            {PODIUM_ORDER.map((playerIndex, slotIndex) => {
              const player = leaderboard[playerIndex];
              if (!player) return null;
              const isWinner = slotIndex === 1;
              const wasEliminated = eliminated.includes(player.id);
              return (
                <div key={player.id} className={`game-podium-slot${wasEliminated ? " is-eliminated" : ""}`}>
                  <div className="game-podium-medal">{wasEliminated ? "💨" : PODIUM_MEDALS[playerIndex]}</div>
                  <div className="game-podium-avatar">{player.avatar || "🎮"}</div>
                  <div className="game-podium-name">{player.nickname}</div>
                  <div
                    className={`game-podium-bar${isWinner ? " is-winner" : ""}`}
                    style={{ height: PODIUM_HEIGHTS[playerIndex] }}
                  >
                    <span className="game-podium-score">{(player.score ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Team Battle: team podium */}
        {gameMode === "team" && teamList.length > 0 && (
          <div className="game-podium">
            {[teamList[1], teamList[0], teamList[2]].map((team, slotIndex) => {
              if (!team) return null;
              const ranks = [1, 0, 2] as const;
              const rank = ranks[slotIndex];
              return (
                <div key={team.id} className="game-podium-slot">
                  <div className="game-podium-medal">{['🥈','🥇','🥉'][rank]}</div>
                  <div className="game-podium-avatar" style={{ fontSize: "2rem" }}>{team.emoji}</div>
                  <div className="game-podium-name">{team.name}</div>
                  <div
                    className={`game-podium-bar${rank === 0 ? " is-winner" : ""}`}
                    style={{ height: PODIUM_HEIGHTS[rank], background: `${team.color}44`, borderColor: team.color }}
                  >
                    <span className="game-podium-score">{team.score.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Classic + Survival: individual final list */}
        {gameMode !== "team" && (
          <div className="game-final-list">
            {leaderboard.map((player, index) => {
              const wasEliminated = eliminated.includes(player.id);
              return (
                <div key={player.id} className={`game-final-row${index === 0 && !wasEliminated ? " is-first" : ""}${wasEliminated ? " is-eliminated-row" : ""}`}>
                  <span className="game-final-name">
                    {wasEliminated ? "💨" : index < 3 ? PODIUM_MEDALS[index] : `${index + 1}.`}{" "}
                    {player.avatar || "🎮"} {player.nickname}
                    {wasEliminated && <span className="game-final-eliminated-tag">eliminated</span>}
                    {(playerAchievements[player.id] ?? []).map((badge, bi) => (
                      <span key={bi} className="game-final-badge" title={badge.label}>{badge.emoji}</span>
                    ))}
                  </span>
                  <span className="game-final-score">
                    {playerCorrectCounts[player.id] ?? 0}/{totalQuestions} ✓ · {(player.score ?? 0).toLocaleString()} pts
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Team Battle: team + member breakdown */}
        {gameMode === "team" && (
          <TeamLeaderboard teams={teams} players={leaderboard} teamAssignments={teamAssignments} />
        )}

        {isHost && (
          <div className="game-ai-section">
            {!aiSummary && !aiSummaryLoading && (
              <button onClick={onGenerateAiSummary} className="btn btn-secondary" style={{ width: "100%" }}>
                🧠 Get AI Insights
              </button>
            )}
            {aiSummaryLoading && (
              <div className="game-ai-loading">🧠 Analyzing game data...</div>
            )}
            {aiSummary && (
              <div className="game-ai-result">
                <div className="game-ai-result-label">🧠 AI Insights</div>
                <div className="game-ai-result-text">{aiSummary}</div>
              </div>
            )}
          </div>
        )}

        <div className="game-finished-actions">
          {isHost && quizId && (
            <Link href={`/host?quiz=${quizId}`} className="btn btn-primary">Play Again 🔄</Link>
          )}
          {isHost && (
            <Link href={`/report/${pin}`} className="btn btn-secondary">View Report 📊</Link>
          )}
          <Link href="/" className="btn btn-secondary">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}

// ─── SurvivalStatusBar ────────────────────────────────────────────────────────

export function SurvivalStatusBar({
  aliveCount,
  totalPlayers,
  eliminated,
  myPlayerId,
}: {
  aliveCount: number;
  totalPlayers: number;
  eliminated: string[];
  myPlayerId: string | null;
}) {
  const isEliminated = myPlayerId ? eliminated.includes(myPlayerId) : false;

  return (
    <div className={`survival-status-bar${isEliminated ? " survival-status-bar--out" : ""}`}>
      {isEliminated ? (
        <div className="survival-eliminated-banner">
          <span className="survival-eliminated-icon">💀</span>
          <div>
            <div className="survival-eliminated-title">You&apos;re Eliminated!</div>
            <div className="survival-eliminated-sub">Watch the remaining players fight it out</div>
          </div>
        </div>
      ) : (
        <>
          <span className="survival-alive-icon">💚</span>
          <span className="survival-alive-label">
            <strong>{aliveCount}</strong> player{aliveCount !== 1 ? "s" : ""} still alive
          </span>
          <div className="survival-alive-bar">
            <div
              className="survival-alive-fill"
              style={{ width: `${(aliveCount / Math.max(totalPlayers, 1)) * 100}%` }}
            />
          </div>
          <span className="survival-total">{totalPlayers} total</span>
        </>
      )}
    </div>
  );
}

// ─── TeamScoreBar ─────────────────────────────────────────────────────────────

type Team = { id: string; name: string; color: string; emoji: string; score: number };

export function TeamScoreBar({
  teams,
  myTeamId,
}: {
  teams: Record<string, Team>;
  myTeamId: string | null;
}) {
  const teamList = Object.values(teams).sort((a, b) => b.score - a.score);
  const maxScore = Math.max(...teamList.map(t => t.score), 1);

  return (
    <div className="team-score-bar">
      {teamList.map((team, i) => (
        <div
          key={team.id}
          className={`team-score-row${team.id === myTeamId ? " team-score-row--mine" : ""}`}
        >
          <span className="team-score-rank">#{i + 1}</span>
          <span className="team-score-emoji">{team.emoji}</span>
          <span className="team-score-name">{team.name}</span>
          <div className="team-score-track">
            <div
              className="team-score-fill"
              style={{
                width: `${(team.score / maxScore) * 100}%`,
                background: team.color,
              }}
            />
          </div>
          <span className="team-score-pts">{team.score.toLocaleString()}</span>
          {team.id === myTeamId && <span className="team-score-you">← You</span>}
        </div>
      ))}
    </div>
  );
}

// ─── TeamLeaderboard ──────────────────────────────────────────────────────────

export function TeamLeaderboard({
  teams,
  players,
  teamAssignments,
}: {
  teams: Record<string, Team>;
  players: GamePlayer[];
  teamAssignments: Record<string, string>;
}) {
  const teamList = Object.values(teams).sort((a, b) => b.score - a.score);

  return (
    <div className="team-leaderboard">
      <h3 className="game-leaderboard-title">Team Scores</h3>
      {teamList.map((team, i) => {
        const teamPlayers = players.filter(p => teamAssignments[p.id] === team.id);
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
        return (
          <div key={team.id} className="team-lb-row" style={{ borderColor: team.color }}>
            <div className="team-lb-header">
              <span>{medal} {team.emoji} {team.name}</span>
              <span className="team-lb-score" style={{ color: team.color }}>
                {team.score.toLocaleString()} pts
              </span>
            </div>
            <div className="team-lb-players">
              {teamPlayers.map(p => (
                <span key={p.id} className="team-lb-player">
                  {p.avatar || "🎮"} {p.nickname}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

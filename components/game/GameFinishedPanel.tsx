"use client";

import { useState } from "react";
import Link from "next/link";
import { GameNotice } from "./GameNotice";
import { TeamLeaderboard } from "./TeamLeaderboard";
import type { GamePlayer } from "@/lib/game/session-normalizers";
import type { Team } from "./TeamScoreBar";

type GameSessionData = { quiz_id?: string };

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
  myTeamId,
  onPlayAgain,
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
  myTeamId?: string | null;
  onPlayAgain?: () => void;
}) {
  const quizId = (session as GameSessionData)?.quiz_id;
  const [shareCopied, setShareCopied] = useState(false);

  // Compute final score for the share message (top score or player's own)
  const topScore = leaderboard[0]?.score ?? 0;

  function handleShareScore() {
    const shareScore = gameMode === "team" && myTeamId && teams[myTeamId]
      ? teams[myTeamId].score
      : topScore;
    const shareMsg = gameMode === "team" && myTeamId && teams[myTeamId]
      ? `My team scored ${shareScore.toLocaleString()} points on QuizWorld! Play at quizworld.xyz`
      : `I scored ${shareScore.toLocaleString()} points on QuizWorld! Play at quizworld.xyz`;
    const text = shareMsg;
    navigator.clipboard.writeText(text).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }).catch(() => {});
  }

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
                  <div className="game-podium-medal">{['🥈','🥇','🥉'][slotIndex]}</div>
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
          <TeamLeaderboard teams={teams} players={leaderboard} teamAssignments={teamAssignments} myTeamId={myTeamId} />
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

        {/* Post-game CTA */}
        <div className="game-finished-cta">
          <hr className="game-finished-cta-divider" />
          <h3 className="game-finished-cta-heading">What&apos;s next?</h3>
          <div className="game-finished-cta-buttons">
            {onPlayAgain && (
              <button onClick={onPlayAgain} className="btn btn-primary btn-compact">
                🔄 Play Again
              </button>
            )}
            <Link href="/explore" className="btn btn-secondary btn-compact">
              🔍 Find Another Quiz
            </Link>
            <Link href="/create" className="btn btn-secondary btn-compact">
              ➕ Create Your Own
            </Link>
            <button onClick={handleShareScore} className="btn btn-secondary btn-compact">
              {shareCopied ? "✅ Copied!" : "📤 Share Score"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

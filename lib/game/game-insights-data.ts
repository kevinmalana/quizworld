import type { GamePlayer, PhoenixSessionSnapshot } from "./session-normalizers";
import { sortLeaderboard } from "./game-analytics";

/** Build only from a complete, finished host snapshot. Never combine public
 * fallback state with stale private history or replace missing counts with zero. */
export function buildGameInsightsData(snapshot: Record<string, unknown> | null, isHost: boolean) {
  if (!isHost || snapshot?.status !== "finished") return null;
  const session = snapshot as PhoenixSessionSnapshot;
  const players = session.players as GamePlayer[] | undefined;
  const total = session.scored_question_count;
  const counts = session.correct_counts;
  const history = session.question_history;
  if (!Array.isArray(players) || !Number.isInteger(total) || total === undefined || total < 0 ||
      !counts || !Array.isArray(history)) return null;
  if (players.some(p => !Object.hasOwn(counts, p.id) || !Number.isInteger(counts[p.id]) || counts[p.id] < 0 || counts[p.id] > total)) return null;
  // Normalization supplies [] for absent history. Verify all revealed indices,
  // including polls, while allowing survival to finish before the quiz ends.
  const questions = session.quiz?.questions;
  const finalIndex = session.current_question_index;
  if (!Array.isArray(questions) || typeof finalIndex !== "number" || !Number.isInteger(finalIndex) ||
      finalIndex < 0 || finalIndex >= questions.length || history.length !== finalIndex + 1) return null;
  if (history.some((q, index) => q.index !== index || !q.question_type || !Array.isArray(q.responses))) return null;
  const scored = history.filter(q => q.question_type !== "poll");
  if (scored.length !== total || scored.some(q => q.responses!.some(r => typeof r.is_correct !== "boolean"))) return null;
  const correct = players.reduce((sum, p) => sum + counts[p.id], 0);
  const mode = session.game_mode ?? "classic";
  return {
    aggregates_available: true,
    game_mode: mode,
    total_players: players.length,
    total_questions: total,
    avg_score: players.length ? Math.round(players.reduce((sum, p) => sum + (p.score ?? 0), 0) / players.length) : 0,
    avg_accuracy: total > 0 && players.length > 0 ? Math.round(correct / (players.length * total) * 100) : null,
    leaderboard: sortLeaderboard(players).slice(0, 5).map(p => ({ score: p.score ?? 0, correct: total > 0 ? counts[p.id] : null })),
    question_stats: scored.map(q => ({
      text: q.text,
      correct_pct: q.responses!.length ? Math.round(q.responses!.filter(r => r.is_correct).length / q.responses!.length * 100) : null,
      avg_time: q.responses!.length ? Math.round(q.responses!.reduce((sum, r) => sum + r.response_time_ms, 0) / q.responses!.length / 100) / 10 : null,
    })),
    eliminated: mode === "survival" ? session.eliminated ?? [] : [],
    teams: mode === "team" ? Object.values(session.teams ?? {}).map(t => ({ score: t.score })) : [],
  };
}

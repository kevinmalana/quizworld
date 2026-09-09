type PlayerResult = {
  id: string;
  nickname: string;
  avatar?: string;
  score: number;
};

type AnswerDistribution = {
  answer_id: string;
  text: string;
  is_correct: boolean | null;
  count: number;
  percentage: number;
};

export type QuestionBreakdown = {
  index: number;
  question_id: string;
  question_type?: string;
  scored?: boolean;
  text: string;
  correct_answer_text?: string | null;
  time_limit: number;
  points: number;
  total_responses: number;
  correct_count: number | null;
  accuracy_pct: number | null;
  avg_response_time_ms: number;
  difficulty: string | null;
  distribution: AnswerDistribution[];
  responses: {
    player_id: string;
    nickname: string;
    avatar?: string;
    answer_id: string;
    is_correct: boolean | null;
    points_awarded: number;
    response_time_ms: number;
  }[];
};

/** Missing historical markers cannot distinguish an opinion from a wrong answer.
 * Keep stored scores, but exclude unknown questions from learning judgments. */
export function questionScoring(q: QuestionBreakdown): "scored" | "unscored" | "unknown" {
  if (q.question_type === "poll" || q.scored === false) return "unscored";
  if (q.scored === true || ["multiple_choice", "true_false", "type_answer"].includes(q.question_type ?? "")) return "scored";
  return "unknown";
}

export function getReportAnalytics(breakdown: QuestionBreakdown[]) {
  const scored = breakdown.filter(q => questionScoring(q) === "scored");
  const accuracyRows = scored.filter(q => q.accuracy_pct !== null);
  const playerAccuracy: Record<string, { correct: number; total: number }> = {};
  for (const q of scored) {
    for (const r of q.responses) {
      if (typeof r.is_correct !== "boolean") continue;
      const accuracy = playerAccuracy[r.player_id] ??= { correct: 0, total: 0 };
      accuracy.total++;
      if (r.is_correct) accuracy.correct++;
    }
  }
  return {
    scored, playerAccuracy,
    unknownCount: breakdown.filter(q => questionScoring(q) === "unknown").length,
    avgAccuracy: accuracyRows.length ? Math.round(accuracyRows.reduce((sum, q) => sum + (q.accuracy_pct ?? 0), 0) / accuracyRows.length) : null,
  };
}

export function buildReportCSV(breakdown: QuestionBreakdown[]) {
  const rows = [["Player", "Question", "Answer", "Correct", "Points", "Response Time (ms)"]];
  for (const q of breakdown) {
    const scoring = questionScoring(q);
    for (const r of q.responses) {
      const answerText = q.distribution.find(d => d.answer_id === r.answer_id)?.text ?? r.answer_id;
      const correctness = scoring === "unscored" ? "Unscored" : scoring === "unknown" ? "Unknown (legacy)"
        : r.is_correct === true ? "Yes" : r.is_correct === false ? "No" : "Unknown";
      rows.push([r.nickname, q.text, answerText, correctness, String(r.points_awarded), String(r.response_time_ms)]);
    }
  }
  return rows.map(r => r.map(c => `"${c.replace(/"/g, '\"\"')}"`).join(",")).join("\n");
}

export type GameResult = {
  id: string;
  pin: string;
  quiz_id: string;
  host_id: string;
  player_count: number;
  results: {
    players: PlayerResult[];
    question_count: number;
    finished_status: string;
    game_mode?: string;
    eliminated?: string[];
    teams?: Record<string, { id: string; name: string; color: string; emoji: string; score: number }>;
    team_assignments?: Record<string, string>;
    question_breakdown?: QuestionBreakdown[];
  };
  finished_at: string;
};

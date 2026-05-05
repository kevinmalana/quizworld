export type ProfileInsightStats = {
  quizCount: number;
  totalPlays: number;
  studiedCount: number;
  hostedGames: number;
  playersReached: number;
  bestHostedScore: number;
};

export type ProfileInsight = {
  label: string;
  value: string;
  helper: string;
  tone: "accent" | "success" | "warning";
};

export function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1000 ? 1 : 0,
  }).format(value);
}

export function formatAverage(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value < 10) return value.toFixed(1).replace(/\.0$/, "");
  return Math.round(value).toString();
}

export function getProfileInsights(stats: ProfileInsightStats): ProfileInsight[] {
  const playsPerQuiz = stats.quizCount > 0 ? stats.totalPlays / stats.quizCount : 0;
  const playersPerHostedGame = stats.hostedGames > 0 ? stats.playersReached / stats.hostedGames : 0;
  const studyCoverage = stats.quizCount > 0 ? Math.min(100, (stats.studiedCount / stats.quizCount) * 100) : 0;

  return [
    {
      label: "Avg plays per quiz",
      value: formatAverage(playsPerQuiz),
      helper:
        stats.quizCount > 0
          ? `${formatCompactNumber(stats.totalPlays)} total plays across ${stats.quizCount} quiz${stats.quizCount === 1 ? "" : "zes"}`
          : "Create your first quiz to start tracking reach.",
      tone: playsPerQuiz >= 10 ? "success" : playsPerQuiz > 0 ? "accent" : "warning",
    },
    {
      label: "Avg players per hosted game",
      value: formatAverage(playersPerHostedGame),
      helper:
        stats.hostedGames > 0
          ? `${formatCompactNumber(stats.playersReached)} players joined ${stats.hostedGames} hosted game${stats.hostedGames === 1 ? "" : "s"}`
          : "Host a live game to measure audience size.",
      tone: playersPerHostedGame >= 5 ? "success" : playersPerHostedGame > 0 ? "accent" : "warning",
    },
    {
      label: "Study coverage",
      value: `${Math.round(studyCoverage)}%`,
      helper:
        stats.quizCount > 0
          ? `${stats.studiedCount} studied set${stats.studiedCount === 1 ? "" : "s"} compared with ${stats.quizCount} created quiz${stats.quizCount === 1 ? "" : "zes"}`
          : "Build a library, then use Study to reinforce it.",
      tone: studyCoverage >= 75 ? "success" : studyCoverage > 0 ? "accent" : "warning",
    },
  ];
}

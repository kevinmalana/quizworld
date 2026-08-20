export type LeaderboardPeriod = "global" | "weekly";

export type LeaderboardXpEntry = {
  total_xp: number;
  weekly_xp?: number;
};

export function getLeaderboardXp(entry: LeaderboardXpEntry, period: LeaderboardPeriod) {
  return period === "weekly" ? (entry.weekly_xp ?? 0) : entry.total_xp;
}

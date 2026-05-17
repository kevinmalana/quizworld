"use client";

import { useMemo } from "react";

export type StudyProgressRow = {
  quiz_id: string;
  questions_studied: number;
  correct: number;
  mastery: number;
  last_studied: string;
};

export type StudySessionRow = {
  id: string;
  xp_earned: number;
  correct: number;
  total: number;
  study_mode: string;
  duration_secs: number | null;
  created_at: string;
};

function calcLevel(totalXp: number) {
  let level = 1;
  let xpNeeded = 200;
  while (totalXp >= xpNeeded) {
    level++;
    xpNeeded += level * 200;
  }
  const levelStartXp = (level - 1) * level * 100;
  const levelEndXp = level * (level + 1) * 100;
  const progress = ((totalXp - levelStartXp) / (levelEndXp - levelStartXp)) * 100;
  return {
    level,
    progress: Math.min(100, Math.max(0, progress)),
    currentXp: totalXp - levelStartXp,
    xpToNext: levelEndXp - totalXp,
  };
}

function XpProgressBar({ totalXp }: { totalXp: number }) {
  const { level, progress, currentXp, xpToNext } = useMemo(() => calcLevel(totalXp), [totalXp]);

  return (
    <div className="card study-xp-progress">
      <div className="study-xp-progress__header">
        <div className="study-xp-progress__level">
          <span className="study-xp-progress__icon">⭐</span>
          <span>Level {level}</span>
        </div>
        <span className="study-xp-progress__count">
          {currentXp.toLocaleString()} / {xpToNext.toLocaleString()} XP
        </span>
      </div>
      <progress className="study-xp-progress__bar" value={progress} max={100} />
      <div className="study-xp-progress__next">
        {Math.round(progress)}% to Level {level + 1}
      </div>
    </div>
  );
}

function StreakBadge({ streak, longest }: { streak: number; longest: number }) {
  const isActive = streak > 0;
  return (
    <div className="card study-streak-card">
      <div className="study-streak-card__row">
        <span className="study-streak-card__icon">{isActive ? "🔥" : "💤"}</span>
        <span className="study-streak-card__value">{streak}</span>
        <span className="study-streak-card__label">day streak</span>
      </div>
      {longest > 0 && <div className="study-streak-card__best">Personal best: {longest} days</div>}
    </div>
  );
}

function MasteryBarChart({ progress }: { progress: StudyProgressRow[] }) {
  if (progress.length === 0) return null;

  const buckets = [
    { label: "0–20%", min: 0, max: 20, color: "#ef4444" },
    { label: "21–40%", min: 21, max: 40, color: "#f97316" },
    { label: "41–60%", min: 41, max: 60, color: "#eab308" },
    { label: "61–80%", min: 61, max: 80, color: "#3b82f6" },
    { label: "81–100%", min: 81, max: 100, color: "#22c55e" },
  ];
  const counts = buckets.map(() => 0);
  for (const entry of progress) {
    const bucket = buckets.findIndex((b) => (entry.mastery ?? 0) >= b.min && (entry.mastery ?? 0) <= b.max);
    if (bucket >= 0) counts[bucket]++;
  }
  const maxCount = Math.max(...counts, 1);

  return (
    <div className="study-mastery-chart">
      {buckets.map((bucket, i) => {
        const count = counts[i];
        const pct = (count / maxCount) * 100;
        return (
          <div key={bucket.label} className="study-mastery-chart__row">
            <div className="study-mastery-chart__label">{bucket.label}</div>
            <div className="study-mastery-chart__track">
              <div className="study-mastery-chart__bar" style={{ width: `${pct}%`, background: bucket.color, minWidth: count > 0 ? 8 : 0 }} />
            </div>
            <div className="study-mastery-chart__count">{count}</div>
          </div>
        );
      })}
    </div>
  );
}

function XpHistorySparkline({ sessions }: { sessions: StudySessionRow[] }) {
  const last7Days = useMemo(() => {
    const days: { label: string; xp: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        xp: sessions.filter((s) => s.created_at?.startsWith(iso)).reduce((sum, s) => sum + (s.xp_earned ?? 0), 0),
      });
    }
    return days;
  }, [sessions]);
  const maxXp = Math.max(...last7Days.map((d) => d.xp), 1);

  return (
    <div className="card study-chart-card">
      <div className="study-chart-title">
        XP Earned — Last 7 Days
      </div>
      <div className="study-xp-sparkline">
        {last7Days.map((day, i) => (
          <div key={i} className="study-xp-sparkline__day">
            <div className={day.xp > 0 ? "study-xp-sparkline__bar has-xp" : "study-xp-sparkline__bar"} style={{ height: Math.round((day.xp / maxXp) * 56) + 4 }} title={`${day.xp} XP`} />
          </div>
        ))}
      </div>
      <div className="study-xp-sparkline__labels">
        {last7Days.map((day, i) => (
          <div key={i}>{day.label}</div>
        ))}
      </div>
    </div>
  );
}

function StudyStatCard({ icon, value, label, color }: { icon: string; value: string | number; label: string; color: string }) {
  return (
    <div className="card study-stat-card">
      <div className="study-stat-card__icon">{icon}</div>
      <div className="study-stat-card__value" style={{ color }}>{value}</div>
      <div className="study-stat-card__label">{label}</div>
    </div>
  );
}

export function StudyStatsDashboard({
  totalXp,
  streak,
  longestStreak,
  studiedCount,
  avgMastery,
  accuracyRate,
  totalSessionXp,
  progress,
  sessions,
}: {
  totalXp: number;
  streak: number;
  longestStreak: number;
  studiedCount: number;
  avgMastery: number;
  accuracyRate: number;
  totalSessionXp: number;
  progress: StudyProgressRow[];
  sessions: StudySessionRow[];
}) {
  return (
    <>
      <div className="study-dashboard-hero">
        <XpProgressBar totalXp={totalXp} />
        <StreakBadge streak={streak} longest={longestStreak} />
      </div>

      <div className="study-stat-grid">
        <StudyStatCard icon="📚" value={studiedCount} label="Quizzes Studied" color="var(--accent)" />
        <StudyStatCard icon="🎯" value={`${avgMastery}%`} label="Avg Mastery" color="var(--secondary)" />
        <StudyStatCard icon="✅" value={`${accuracyRate}%`} label="Accuracy" color="var(--success)" />
        <StudyStatCard icon="⚡" value={`+${totalSessionXp.toLocaleString()}`} label="Session XP" color="#8b5cf6" />
      </div>

      {progress.length > 0 && (
        <div className="study-chart-grid">
          <div className="card study-chart-card">
            <div className="study-chart-title">
              Mastery Distribution
            </div>
            <MasteryBarChart progress={progress} />
          </div>
          {sessions.length > 0 && <XpHistorySparkline sessions={sessions} />}
        </div>
      )}
    </>
  );
}

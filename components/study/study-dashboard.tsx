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
    <div className="card" style={{ padding: "1.25rem", border: "1px solid var(--line)", background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.25rem" }}>⭐</span>
          <span style={{ fontWeight: 800, fontSize: "1rem" }}>Level {level}</span>
        </div>
        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--muted)" }}>
          {currentXp.toLocaleString()} / {xpToNext.toLocaleString()} XP
        </span>
      </div>
      <div style={{ height: 10, background: "rgba(0,0,0,0.08)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #8b5cf6, #a78bfa)", borderRadius: 999, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--muted)", textAlign: "right" }}>
        {Math.round(progress)}% to Level {level + 1}
      </div>
    </div>
  );
}

function StreakBadge({ streak, longest }: { streak: number; longest: number }) {
  const isActive = streak > 0;
  return (
    <div className="card" style={{ padding: "1rem 1.25rem", border: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
        <span style={{ fontSize: "1.1rem" }}>{isActive ? "🔥" : "💤"}</span>
        <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>{streak}</span>
        <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>day streak</span>
      </div>
      {longest > 0 && <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Personal best: {longest} days</div>}
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
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {buckets.map((bucket, i) => {
        const count = counts[i];
        const pct = (count / maxCount) * 100;
        return (
          <div key={bucket.label} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: 52, fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", textAlign: "right", flexShrink: 0 }}>{bucket.label}</div>
            <div style={{ flex: 1, height: 22, background: "var(--bg)", borderRadius: 999, overflow: "hidden", border: "1px solid var(--line)" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: bucket.color, borderRadius: 999, transition: "width 0.4s ease", minWidth: count > 0 ? 8 : 0 }} />
            </div>
            <div style={{ width: 24, fontSize: "0.75rem", fontWeight: 700, color: "var(--ink)", flexShrink: 0, textAlign: "right" }}>{count}</div>
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
    <div className="card" style={{ padding: "1.25rem", border: "1px solid var(--line)" }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: "1rem" }}>
        XP Earned — Last 7 Days
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.4rem", height: 64 }}>
        {last7Days.map((day, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
            <div style={{ width: "100%", height: Math.round((day.xp / maxXp) * 56) + 4, borderRadius: "6px 6px 0 0", background: day.xp > 0 ? "linear-gradient(180deg, #8b5cf6, #a78bfa)" : "var(--bg)", border: day.xp > 0 ? "none" : "1px solid var(--line)", transition: "height 0.3s ease" }} title={`${day.xp} XP`} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
        {last7Days.map((day, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "0.65rem", fontWeight: 700, color: "var(--muted)" }}>{day.label}</div>
        ))}
      </div>
    </div>
  );
}

function StudyStatCard({ icon, value, label, color }: { icon: string; value: string | number; label: string; color: string }) {
  return (
    <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
      <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>{icon}</div>
      <div style={{ fontWeight: 900, fontSize: "1.4rem", color }}>{value}</div>
      <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>{label}</div>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", marginBottom: "1.5rem", alignItems: "stretch" }}>
        <XpProgressBar totalXp={totalXp} />
        <StreakBadge streak={streak} longest={longestStreak} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <StudyStatCard icon="📚" value={studiedCount} label="Quizzes Studied" color="var(--accent)" />
        <StudyStatCard icon="🎯" value={`${avgMastery}%`} label="Avg Mastery" color="var(--secondary)" />
        <StudyStatCard icon="✅" value={`${accuracyRate}%`} label="Accuracy" color="var(--success)" />
        <StudyStatCard icon="⚡" value={`+${totalSessionXp.toLocaleString()}`} label="Session XP" color="#8b5cf6" />
      </div>

      {progress.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="card" style={{ padding: "1.25rem", border: "1px solid var(--line)" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: "1rem" }}>
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

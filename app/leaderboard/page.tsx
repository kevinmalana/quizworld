"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { calcLevel } from "@/components/study/study-session-panels";
import "@/styles/social.css";
import "@/styles/leaderboard.css";

type LeaderboardEntry = {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string;
  total_xp: number;
  weekly_xp?: number;
  study_streak: number;
};

type TabType = "global" | "weekly";

function LeaderboardRow({ entry, rank, isMe, showWeekly }: { entry: LeaderboardEntry; rank: number; isMe: boolean; showWeekly?: boolean }) {
  const lv = calcLevel(entry.total_xp);
  const xpDisplay = showWeekly ? (entry.weekly_xp ?? 0) : entry.total_xp;
  const podiumClass =
    rank === 1 ? "leaderboard-row leaderboard-row--gold" :
    rank === 2 ? "leaderboard-row leaderboard-row--silver" :
    rank === 3 ? "leaderboard-row leaderboard-row--bronze" :
    `leaderboard-row${isMe ? " leaderboard-row--me" : ""}`;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

  return (
    <div className={podiumClass} style={isMe ? { border: "2px solid var(--accent)" } : {}}>
      <div className="leaderboard-rank">{medal}</div>
      {(entry.avatar||"👤").startsWith("http") ? <img src={entry.avatar} alt={entry.display_name||entry.username} className="leaderboard-avatar" style={{borderRadius:"50%",objectFit:"cover"}} /> : <div className="leaderboard-avatar">{entry.avatar||"👤"}</div>}
      <div className="leaderboard-info">
        <div className="leaderboard-name">{entry.display_name || entry.username} {isMe && <span className="leaderboard-you-tag">← You</span>}</div>
        <div className="leaderboard-handle">
          <Link href={`/u/${entry.username}`} className="leaderboard-username-link">@{entry.username}</Link>
          {" · "}
          <span className="social-level-badge">⭐ Lv {lv.level} · {lv.title}</span>
        </div>
      </div>
      {entry.study_streak > 0 && (
        <div className="leaderboard-streak">🔥 {entry.study_streak}d</div>
      )}
      <div className="leaderboard-xp">{xpDisplay.toLocaleString()} XP</div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabType>("global");
  const [globalEntries, setGlobalEntries] = useState<LeaderboardEntry[]>([]);
  const [weeklyEntries, setWeeklyEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const [globalRes, weeklyRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, display_name, avatar, total_xp, study_streak")
          .order("total_xp", { ascending: false })
          .limit(50),
        supabase
          .from("leaderboard_weekly")
          .select("*")
          .limit(50),
      ]);

      if (globalRes.error) { setError("Could not load leaderboard."); setLoading(false); return; }

      setGlobalEntries(
        (globalRes.data ?? []).map(p => ({
          user_id: p.id,
          username: p.username ?? "",
          display_name: p.display_name ?? "",
          avatar: p.avatar ?? "👤",
          total_xp: (p.total_xp as number) ?? 0,
          study_streak: (p.study_streak as number) ?? 0,
        }))
      );

      setWeeklyEntries(
        (weeklyRes.data ?? []).map((p: Record<string, unknown>) => ({
          user_id: p.user_id as string,
          username: (p.username as string) ?? "",
          display_name: (p.display_name as string) ?? "",
          avatar: (p.avatar as string) ?? "👤",
          total_xp: (p.total_xp as number) ?? 0,
          weekly_xp: (p.weekly_xp as number) ?? 0,
          study_streak: (p.study_streak as number) ?? 0,
        }))
      );

      setLoading(false);
    }
    load();
  }, []);

  const entries = tab === "global" ? globalEntries : weeklyEntries;
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="container social-shell">
      <div className="social-header">
        <h1 className="font-display">🏆 Leaderboard</h1>
        <p>Top players ranked by XP across the entire QuizWorld community.</p>
      </div>

      <div className="social-tabs">
        <button
          className={`social-tab${tab === "global" ? " is-active" : ""}`}
          onClick={() => setTab("global")}
        >
          🌍 Global (All-time)
        </button>
        <button
          className={`social-tab${tab === "weekly" ? " is-active" : ""}`}
          onClick={() => setTab("weekly")}
        >
          📅 This Week
        </button>
      </div>

      {error ? (
        <div className="social-empty">
          <div className="social-empty-icon">⚠️</div>
          <div className="social-empty-title">{error}</div>
          <button className="btn btn-primary btn-compact" onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : loading ? (
        <div className="social-empty">
          <div className="social-empty-icon">📡</div>
          <div>Loading rankings...</div>
        </div>
      ) : entries.length === 0 ? (
        <div className="social-empty">
          <div className="social-empty-icon">🏆</div>
          <div className="social-empty-title">No data yet</div>
          <div className="social-empty-text">Start playing to get on the board!</div>
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          {top3.length >= 3 && (
            <div className="leaderboard-podium">
              {[top3[1], top3[0], top3[2]].map((entry, podiumIdx) => {
                const rank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
                const lv = calcLevel(entry.total_xp);
                return (
                  <div
                    key={entry.user_id}
                    className={`leaderboard-podium-item leaderboard-podium-item--${rank === 1 ? "first" : rank === 2 ? "second" : "third"}`}
                  >
                    <div className="leaderboard-podium-medal">
                      {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
                    </div>
                    {(entry.avatar||"👤").startsWith("http") ? <img src={entry.avatar} alt={entry.display_name||entry.username} className="leaderboard-podium-avatar" style={{borderRadius:"50%",objectFit:"cover"}} /> : <div className="leaderboard-podium-avatar">{entry.avatar||"👤"}</div>}
                    <div className="leaderboard-podium-name">{entry.display_name || entry.username}</div>
                    <span className="social-level-badge">⭐ Lv {lv.level}</span>
                    <div className="leaderboard-podium-xp">{entry.total_xp.toLocaleString()} XP</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* All rows */}
          <div className="leaderboard-list">
            {tab === "weekly" && (
              <div className="leaderboard-week-label">Ranked by XP earned this week</div>
            )}
            {entries.map((entry, i) => (
              <LeaderboardRow
                key={entry.user_id}
                entry={entry}
                rank={i + 1}
                isMe={user?.id === entry.user_id}
                showWeekly={tab === "weekly"}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

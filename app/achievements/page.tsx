"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import "@/styles/social.css";
import "@/styles/achievements.css";

type Achievement = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  earned: boolean;
  earned_at?: string;
};

type FilterType = "all" | "earned" | "locked";

export default function AchievementsPage() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [achRes, earnedRes] = await Promise.all([
        supabase.from("achievements").select("slug, name, description, icon, xp_reward").order("xp_reward", { ascending: true }),
        user
          ? supabase.from("user_achievements").select("achievement_slug, earned_at").eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
      ]);

      const earnedMap = new Map<string, string>();
      for (const row of (earnedRes.data ?? [])) {
        earnedMap.set(row.achievement_slug, row.earned_at);
      }

      setAchievements(
        (achRes.data ?? []).map(a => ({
          slug: a.slug,
          name: a.name,
          description: a.description,
          icon: a.icon,
          xp_reward: a.xp_reward ?? 0,
          earned: earnedMap.has(a.slug),
          earned_at: earnedMap.get(a.slug),
        }))
      );

      setLoading(false);
    }
    load();
  }, [user?.id]);

  const filtered =
    filter === "earned"
      ? achievements.filter(a => a.earned)
      : filter === "locked"
      ? achievements.filter(a => !a.earned)
      : achievements;

  const earnedCount = achievements.filter(a => a.earned).length;
  const totalXpAvailable = achievements.reduce((s, a) => s + a.xp_reward, 0);
  const earnedXp = achievements.filter(a => a.earned).reduce((s, a) => s + a.xp_reward, 0);

  return (
    <div className="container social-shell">
      <div className="social-header">
        <h1 className="font-display">🏅 Achievements</h1>
        <p>Unlock achievements by playing, studying, and reaching milestones.</p>
      </div>

      {/* Stats bar */}
      {achievements.length > 0 && (
        <div className="achievements-stats">
          <div className="achievements-stat">
            <div className="achievements-stat-value">{earnedCount}</div>
            <div className="achievements-stat-label">Earned</div>
          </div>
          <div className="achievements-stat">
            <div className="achievements-stat-value">{achievements.length - earnedCount}</div>
            <div className="achievements-stat-label">Locked</div>
          </div>
          <div className="achievements-stat">
            <div className="achievements-stat-value">{earnedXp.toLocaleString()}</div>
            <div className="achievements-stat-label">XP from achievements</div>
          </div>
          <div className="achievements-stat">
            <div className="achievements-stat-value">{totalXpAvailable.toLocaleString()}</div>
            <div className="achievements-stat-label">Total available XP</div>
          </div>
        </div>
      )}

      {/* Filter row */}
      <div className="achievements-filter-row">
        {(["all", "earned", "locked"] as FilterType[]).map(f => (
          <button
            key={f}
            className={`achievements-filter-btn${filter === f ? " is-active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? `All (${achievements.length})` : f === "earned" ? `✅ Earned (${earnedCount})` : `🔒 Locked (${achievements.length - earnedCount})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="social-empty">
          <div className="social-empty-icon">📡</div>
          <div>Loading achievements...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="social-empty">
          <div className="social-empty-icon">🏅</div>
          <div className="social-empty-title">
            {filter === "earned" ? "No achievements earned yet" : filter === "locked" ? "All achievements unlocked! 🎉" : "No achievements found"}
          </div>
          {filter === "earned" && (
            <div className="social-empty-text">Start playing and studying to earn your first achievement!</div>
          )}
        </div>
      ) : (
        <div className="achievement-grid">
          {filtered.map(a => (
            <div
              key={a.slug}
              className={`card achievement-card${a.earned ? " achievement-card--earned" : " achievement-card--locked"}`}
            >
              <div className="achievement-icon">{a.icon}</div>
              <div className="achievement-name">{a.name}</div>
              <div className="achievement-desc">{a.description}</div>
              <div className="achievement-xp">+{a.xp_reward.toLocaleString()} XP</div>
              {a.earned ? (
                <div className="achievement-earned-badge">✅ Earned</div>
              ) : (
                <div className="achievement-locked-badge">🔒 Locked</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

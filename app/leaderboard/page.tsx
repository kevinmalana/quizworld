"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { CATEGORY_EMOJIS } from "@/lib/store";
import { PageHero } from "@/components/page-hero";

type Tab = "players" | "quizzes" | "creators";

type PlayerRow = {
  id: string;
  nickname: string | null;
  total_xp: number;
  study_streak: number;
};

type QuizRow = {
  id: string;
  title: string;
  emoji: string | null;
  color: string | null;
  category: string | null;
  plays: number;
  creator_id: string;
};

type CreatorRow = {
  id: string;
  nickname: string | null;
  quiz_count: number;
  total_plays: number;
};

const TAB_CONFIG: { value: Tab; label: string; icon: string }[] = [
  { value: "players", label: "Top Players", icon: "⭐" },
  { value: "quizzes", label: "Top Quizzes", icon: "🏆" },
  { value: "creators", label: "Top Creators", icon: "👑" },
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span style={{ fontSize: "1.5rem" }} title="1st place">🥇</span>
    );
  if (rank === 2)
    return (
      <span style={{ fontSize: "1.5rem" }} title="2nd place">🥈</span>
    );
  if (rank === 3)
    return (
      <span style={{ fontSize: "1.5rem" }} title="3rd place">🥉</span>
    );
  return (
    <span
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "var(--bg)",
        border: "1px solid var(--line)",
        display: "grid",
        placeItems: "center",
        fontSize: "0.8rem",
        fontWeight: 800,
        color: "var(--muted)",
      }}
    >
      {rank}
    </span>
  );
}

function PlayerLeaderboard({ players }: { players: PlayerRow[] }) {
  if (players.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted)" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🌟</div>
        <p>No players yet. Be the first to start studying and earn XP!</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {players.map((player, index) => {
        const rank = index + 1;
        const displayName = player.nickname || "Anonymous";
        return (
          <div
            key={player.id}
            className="card"
            style={{
              padding: "1rem 1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              border: rank <= 3 ? "1px solid var(--accent)" : "1px solid var(--line)",
              background: rank <= 3 ? "var(--accent-light)" : undefined,
            }}
          >
            <RankBadge rank={rank} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="font-display"
                style={{
                  fontWeight: 800,
                  fontSize: rank <= 3 ? "1.1rem" : "0.95rem",
                  color: "var(--ink)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {displayName}
              </div>
              {player.study_streak > 0 && (
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                  🔥 {player.study_streak} day streak
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                className="font-display"
                style={{
                  fontWeight: 900,
                  fontSize: rank <= 3 ? "1.25rem" : "1rem",
                  color: "var(--accent)",
                }}
              >
                {player.total_xp.toLocaleString()} XP
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuizLeaderboard({ quizzes }: { quizzes: QuizRow[] }) {
  if (quizzes.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted)" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📝</div>
        <p>No public quizzes yet. Create one and host a game to get on the board!</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {quizzes.map((quiz, index) => {
        const rank = index + 1;
        const emoji = quiz.emoji || CATEGORY_EMOJIS[quiz.category ?? ""] || "📌";
        return (
          <div
            key={quiz.id}
            className="card"
            style={{
              padding: "1rem 1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              border: rank <= 3 ? "1px solid var(--accent)" : "1px solid var(--line)",
              background: rank <= 3 ? "var(--accent-light)" : undefined,
            }}
          >
            <RankBadge rank={rank} />
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: quiz.color ? `${quiz.color}15` : "var(--bg)",
                display: "grid",
                placeItems: "center",
                fontSize: "1.5rem",
                flexShrink: 0,
              }}
            >
              {emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="font-display"
                style={{
                  fontWeight: 800,
                  fontSize: rank <= 3 ? "1.05rem" : "0.95rem",
                  color: "var(--ink)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {quiz.title}
              </div>
              {quiz.category && (
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                  {quiz.category}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <div style={{ textAlign: "right" }}>
                <div
                  className="font-display"
                  style={{
                    fontWeight: 900,
                    fontSize: rank <= 3 ? "1.25rem" : "1rem",
                    color: "var(--secondary)",
                  }}
                >
                  {quiz.plays.toLocaleString()}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600 }}>plays</div>
              </div>
              <Link
                href={`/study/${quiz.id}`}
                className="btn btn-secondary"
                style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem", flexShrink: 0 }}
              >
                Study
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CreatorLeaderboard({ creators }: { creators: CreatorRow[] }) {
  if (creators.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted)" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>👑</div>
        <p>No creators yet. Create a quiz to claim the crown!</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {creators.map((creator, index) => {
        const rank = index + 1;
        const displayName = creator.nickname || "Anonymous";
        return (
          <div
            key={creator.id}
            className="card"
            style={{
              padding: "1rem 1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              border: rank <= 3 ? "1px solid var(--accent)" : "1px solid var(--line)",
              background: rank <= 3 ? "var(--accent-light)" : undefined,
            }}
          >
            <RankBadge rank={rank} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="font-display"
                style={{
                  fontWeight: 800,
                  fontSize: rank <= 3 ? "1.1rem" : "0.95rem",
                  color: "var(--ink)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {displayName}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                📚 {creator.quiz_count} quiz{creator.quiz_count !== 1 ? "zes" : ""}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                className="font-display"
                style={{
                  fontWeight: 900,
                  fontSize: rank <= 3 ? "1.25rem" : "1rem",
                  color: "var(--primary)",
                }}
              >
                {creator.total_plays.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600 }}>total plays</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("players");
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [creators, setCreators] = useState<CreatorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function fetchLeaderboard() {
      setLoading(true);

      const [playersResult, quizzesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, nickname, total_xp, study_streak")
          .order("total_xp", { ascending: false })
          .limit(50),
        supabase
          .from("quizzes")
          .select("id, title, emoji, color, category, plays, creator_id")
          .eq("is_public", true)
          .is("archived_at", null)
          .order("plays", { ascending: false })
          .limit(50),
      ]);

      if (ignore) return;

      const topPlayers = (playersResult.data ?? []).filter(
        (p: any) => (p.total_xp ?? 0) > 0
      ) as PlayerRow[];
      setPlayers(topPlayers);

      const topQuizzes = (quizzesResult.data ?? []) as QuizRow[];
      setQuizzes(topQuizzes);

      // Aggregate creator stats from quizzes
      const creatorMap = new Map<string, { quiz_count: number; total_plays: number }>();
      for (const quiz of topQuizzes) {
        const existing = creatorMap.get(quiz.creator_id) ?? { quiz_count: 0, total_plays: 0 };
        existing.quiz_count += 1;
        existing.total_plays += quiz.plays ?? 0;
        creatorMap.set(quiz.creator_id, existing);
      }

      // Fetch creator profiles
      const creatorIds = [...creatorMap.keys()];
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nickname")
          .in("id", creatorIds);

        const profileMap = new Map<string, string | null>();
        for (const p of profiles ?? []) {
          profileMap.set(p.id, p.nickname);
        }

        const topCreators: CreatorRow[] = creatorIds
          .map((id) => ({
            id,
            nickname: profileMap.get(id) ?? null,
            quiz_count: creatorMap.get(id)?.quiz_count ?? 0,
            total_plays: creatorMap.get(id)?.total_plays ?? 0,
          }))
          .sort((a, b) => b.total_plays - a.total_plays)
          .slice(0, 50);

        if (!ignore) setCreators(topCreators);
      }

      setLoading(false);
    }

    fetchLeaderboard();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div style={{ minHeight: "calc(100vh - 72px)", background: "var(--bg)", paddingBottom: "5rem" }}>
      <div className="container" style={{ paddingTop: "3rem" }}>
        <PageHero
          eyebrow="Community"
          title="Leaderboard"
          description="See who's leading the pack. Top players by XP, most popular quizzes, and the creators behind them."
          accent="linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #7c3aed 100%)"
          actions={
            user ? (
              <Link
                href="/profile"
                className="btn btn-primary"
                style={{
                  background: "rgba(255,255,255,0.18)",
                  border: "1px solid rgba(255,255,255,0.22)",
                }}
              >
                View Your Stats
              </Link>
            ) : (
              <Link
                href="/login"
                className="btn btn-primary"
                style={{
                  background: "rgba(255,255,255,0.18)",
                  border: "1px solid rgba(255,255,255,0.22)",
                }}
              >
                Sign In to Compete
              </Link>
            )
          }
        />

        {/* Tab selector */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginBottom: "1.5rem",
            flexWrap: "wrap",
          }}
        >
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              style={{
                padding: "0.7rem 1.25rem",
                borderRadius: "var(--radius-lg)",
                border: `1.5px solid ${activeTab === tab.value ? "var(--accent)" : "var(--line)"}`,
                background: activeTab === tab.value ? "var(--accent-light)" : "var(--surface)",
                color: activeTab === tab.value ? "var(--accent)" : "var(--muted)",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                transition: "all 0.15s ease",
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⏳</div>
            <p style={{ color: "var(--muted)" }}>Loading leaderboard...</p>
          </div>
        ) : (
          <div>
            {/* Highlight: user's position */}
            {user && activeTab === "players" && (
              <UserRankHighlight userId={user.id} players={players} />
            )}

            {activeTab === "players" && <PlayerLeaderboard players={players} />}
            {activeTab === "quizzes" && <QuizLeaderboard quizzes={quizzes} />}
            {activeTab === "creators" && <CreatorLeaderboard creators={creators} />}
          </div>
        )}
      </div>
    </div>
  );
}

function UserRankHighlight({ userId, players }: { userId: string; players: PlayerRow[] }) {
  const rank = players.findIndex((p) => p.id === userId);
  if (rank < 0) return null;

  const player = players[rank];
  return (
    <div
      className="card"
      style={{
        padding: "1rem 1.25rem",
        marginBottom: "1.5rem",
        border: "2px solid var(--accent)",
        background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
        display: "flex",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      <span style={{ fontSize: "1.25rem" }}>🎯</span>
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 800, color: "var(--ink)" }}>Your position: </span>
        <span className="font-display" style={{ fontWeight: 900, color: "var(--accent)", fontSize: "1.1rem" }}>
          #{rank + 1}
        </span>
        <span style={{ color: "var(--muted)", marginLeft: "0.5rem", fontWeight: 600 }}>
          · {player.total_xp.toLocaleString()} XP
        </span>
      </div>
    </div>
  );
}

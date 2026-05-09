"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase/client";
import {
  type GameResultRow,
  getBestHostedScore,
  getHostedGameCount,
  getTotalHostedPlayers,
} from "@/lib/reporting/game-results";

type ProfileStats = {
  quizCount: number;
  totalPlays: number;
  studiedCount: number;
  hostedGames: number;
  playersReached: number;
  bestHostedScore: number;
};

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProfileStats>({
    quizCount: 0,
    totalPlays: 0,
    studiedCount: 0,
    hostedGames: 0,
    playersReached: 0,
    bestHostedScore: 0,
  });

  useEffect(() => {
    if (!user) {
      setStats({
        quizCount: 0,
        totalPlays: 0,
        studiedCount: 0,
        hostedGames: 0,
        playersReached: 0,
        bestHostedScore: 0,
      });
      setLoading(false);
      return;
    }

    let ignore = false;
    const userId = user.id;

    async function loadProfileStats() {
      const [
        { data: quizzes, error: quizError },
        { data: progress, error: progressError },
        { data: results, error: resultsError },
      ] =
        await Promise.all([
          supabase
            .from("quizzes")
            .select("plays")
            .eq("creator_id", userId)
            .is("archived_at", null),
          supabase
            .from("study_progress")
            .select("quiz_id")
            .eq("user_id", userId),
          supabase
            .from("game_results")
            .select("id, pin, quiz_id, host_id, player_count, finished_at, results")
            .eq("host_id", userId),
        ]);

      if (ignore) return;

      if (quizError) {
        console.error("Error loading quiz stats:", quizError);
      }
      if (progressError) {
        console.error("Error loading study stats:", progressError);
      }
      if (resultsError) {
        console.error("Error loading hosted game results:", resultsError);
      }

      const hostedResults = (results as GameResultRow[] | null) ?? [];

      setStats({
        quizCount: quizzes?.length ?? 0,
        totalPlays: (quizzes ?? []).reduce((sum, quiz) => sum + (quiz.plays ?? 0), 0),
        studiedCount: progress?.length ?? 0,
        hostedGames: getHostedGameCount(hostedResults),
        playersReached: getTotalHostedPlayers(hostedResults),
        bestHostedScore: getBestHostedScore(hostedResults),
      });
      setLoading(false);
    }

    loadProfileStats();

    return () => {
      ignore = true;
    };
  }, [user?.id]);

  if (authLoading || loading) {
    return (
      <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>
        <div className="card" style={{ padding: "3rem", maxWidth: 400, margin: "0 auto" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔐</div>
          <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>
            Sign In Required
          </h2>
          <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
            Please sign in to view your profile.
          </p>
          <Link href="/login" className="btn btn-primary">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "calc(100vh - 72px)", paddingBottom: "5rem" }}>
      <div className="container" style={{ paddingTop: "3rem" }}>
        <div className="card" style={{ padding: "2rem", marginBottom: "2rem", textAlign: "center" }}>
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: "50%",
              background: "var(--accent-light)",
              margin: "0 auto 1rem",
              display: "grid",
              placeItems: "center",
              fontSize: "3rem",
            }}
          >
            👤
          </div>
          <h1 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            {user.email?.split("@")[0] || "Player"}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>{user.email}</p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--accent)" }}>{stats.quizCount}</div>
            <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Quizzes</div>
          </div>
          <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--accent)" }}>{stats.totalPlays}</div>
            <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Quiz Plays</div>
          </div>
          <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--accent)" }}>{stats.studiedCount}</div>
            <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Studied Sets</div>
          </div>
          <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--accent)" }}>{stats.hostedGames}</div>
            <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Hosted Games</div>
          </div>
          <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--accent)" }}>{stats.playersReached}</div>
            <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Players Reached</div>
          </div>
          <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--accent)" }}>{stats.bestHostedScore}</div>
            <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Best Score</div>
          </div>
        </div>

        <div className="card" style={{ padding: "1rem" }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem", borderRadius: "var(--radius-lg)", textDecoration: "none", color: "var(--ink)" }}>
            <span style={{ fontSize: "1.5rem" }}>📚</span>
            <span style={{ fontWeight: 600 }}>My Quizzes</span>
          </Link>
          <Link href="/study" style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem", borderRadius: "var(--radius-lg)", textDecoration: "none", color: "var(--ink)" }}>
            <span style={{ fontSize: "1.5rem" }}>🧠</span>
            <span style={{ fontWeight: 600 }}>Study Progress</span>
          </Link>
          <Link href="/host" style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem", borderRadius: "var(--radius-lg)", textDecoration: "none", color: "var(--ink)" }}>
            <span style={{ fontSize: "1.5rem" }}>🎮</span>
            <span style={{ fontWeight: 600 }}>Host a Game</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

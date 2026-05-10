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
      setStats({ quizCount: 0, totalPlays: 0, studiedCount: 0, hostedGames: 0, playersReached: 0, bestHostedScore: 0 });
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
      ] = await Promise.all([
        supabase.from("quizzes").select("plays").eq("creator_id", userId).is("archived_at", null),
        supabase.from("study_progress").select("quiz_id").eq("user_id", userId),
        supabase.from("game_results").select("id, pin, quiz_id, host_id, player_count, finished_at, results").eq("host_id", userId),
      ]);

      if (ignore) return;

      if (quizError) console.error("Error loading quiz stats:", quizError);
      if (progressError) console.error("Error loading study stats:", progressError);
      if (resultsError) console.error("Error loading hosted game results:", resultsError);

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
    return () => { ignore = true; };
  }, [user?.id]);

  if (authLoading || loading) {
    return <div className="container report-status">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="container report-status">
        <div className="card report-error-card">
          <div className="report-error-icon">🔐</div>
          <h2 className="font-display report-error-title">Sign In Required</h2>
          <p className="report-error-text">Please sign in to view your profile.</p>
          <Link href="/login" className="btn btn-primary">Sign In</Link>
        </div>
      </div>
    );
  }

  const statItems = [
    { label: "Quizzes", value: stats.quizCount },
    { label: "Quiz Plays", value: stats.totalPlays },
    { label: "Studied Sets", value: stats.studiedCount },
    { label: "Hosted Games", value: stats.hostedGames },
    { label: "Players Reached", value: stats.playersReached },
    { label: "Best Score", value: stats.bestHostedScore },
  ];

  return (
    <div className="profile-shell">
      <div className="container profile-container">
        <div className="card profile-header-card">
          <div className="profile-avatar">👤</div>
          <h1 className="font-display profile-name">{user.email?.split("@")[0] || "Player"}</h1>
          <p className="profile-email">{user.email}</p>
        </div>

        <div className="profile-stats-grid">
          {statItems.map((item) => (
            <div key={item.label} className="card profile-stat-card">
              <div className="profile-stat-value">{item.value}</div>
              <div className="profile-stat-label">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="card profile-links-card">
          <Link href="/dashboard" className="profile-link-row">
            <span className="profile-link-icon">📚</span>
            <span className="profile-link-label">My Quizzes</span>
          </Link>
          <Link href="/study" className="profile-link-row">
            <span className="profile-link-icon">🧠</span>
            <span className="profile-link-label">Study Progress</span>
          </Link>
          <Link href="/host" className="profile-link-row">
            <span className="profile-link-icon">🏁</span>
            <span className="profile-link-label">Host a Game</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

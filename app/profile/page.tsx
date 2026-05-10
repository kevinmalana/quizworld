"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase/client";
import {
  type GameResultRow,
  getBestHostedScore,
  getHostedGameCount,
  getTotalHostedPlayers,
} from "@/lib/reporting/game-results";

const AVATARS = ["🦁", "🐯", "🐺", "🦊", "🐸", "🦄", "🐉", "🦋", "🦅", "🐬", "🦝", "🐱"];

type ProfileStats = {
  quizCount: number;
  totalPlays: number;
  studiedCount: number;
  hostedGames: number;
  playersReached: number;
  bestHostedScore: number;
};

type Tab = "overview" | "edit" | "account";

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<ProfileStats>({ quizCount: 0, totalPlays: 0, studiedCount: 0, hostedGames: 0, playersReached: 0, bestHostedScore: 0 });
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("👤");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar")
      .eq("id", user.id)
      .single();
    if (profile) {
      setDisplayName(profile.display_name || "");
      setAvatar(profile.avatar || "👤");
    }
  }, [user]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const userId = user.id;
    let ignore = false;
    async function load() {
      const [pResult, progResult, resResult, profileResult] = await Promise.all([
        supabase.from("quizzes").select("plays").eq("creator_id", userId).is("archived_at", null),
        supabase.from("study_progress").select("quiz_id").eq("user_id", userId),
        supabase.from("game_results").select("id, pin, quiz_id, host_id, player_count, finished_at, results").eq("host_id", userId),
        supabase.from("profiles").select("display_name, avatar").eq("id", userId).single(),
      ]);
      if (ignore) return;
      const hostedResults = (resResult.data as GameResultRow[] | null) ?? [];
      setStats({
        quizCount: pResult.data?.length ?? 0,
        totalPlays: (pResult.data ?? []).reduce((s, q) => s + (q.plays ?? 0), 0),
        studiedCount: progResult.data?.length ?? 0,
        hostedGames: getHostedGameCount(hostedResults),
        playersReached: getTotalHostedPlayers(hostedResults),
        bestHostedScore: getBestHostedScore(hostedResults),
      });
      if (profileResult.data) {
        setDisplayName(profileResult.data.display_name || "");
        setAvatar(profileResult.data.avatar || "👤");
      }
      setLoading(false);
    }
    load();
    return () => { ignore = true; };
  }, [user?.id]);

  async function handleSaveProfile() {
    if (!user) return;
    setSaving(true);
    setSaveMsg("");
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null, avatar, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    setSaveMsg(error ? "Failed to save." : "✅ Saved!");
    setSaving(false);
  }

  async function handleChangePassword() {
    setPasswordMsg("");
    if (newPassword.length < 6) { setPasswordMsg("Password must be at least 6 characters."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordMsg(error ? error.message : "✅ Password changed!");
    if (!error) { setCurrentPassword(""); setNewPassword(""); }
  }

  if (authLoading || loading) return <div className="container loading-panel">Loading...</div>;
  if (!user) return <div className="container loading-panel"><p className="text-muted">Sign in to view your profile.</p></div>;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "📊 Overview" },
    { key: "edit", label: "✏️ Edit Profile" },
    { key: "account", label: "⚙️ Account" },
  ];

  return (
    <div className="profile-shell">
      <div className="container profile-container">
        <div className="card profile-header-card">
          <div className="profile-avatar">{avatar}</div>
          <h1 className="font-display profile-name">{displayName || user.email?.split("@")[0] || "Player"}</h1>
          {displayName && <p className="profile-email">{user.email}</p>}
        </div>

        <div className="report-tabs" style={{ marginBottom: "1.5rem" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? "report-tab is-active" : "report-tab"}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div>
            <div className="profile-stats-grid">
              {[
                { label: "Quizzes", value: stats.quizCount },
                { label: "Quiz Plays", value: stats.totalPlays },
                { label: "Studied Sets", value: stats.studiedCount },
                { label: "Hosted Games", value: stats.hostedGames },
                { label: "Players Reached", value: stats.playersReached },
                { label: "Best Score", value: stats.bestHostedScore },
              ].map(s => (
                <div key={s.label} className="card profile-stat-card">
                  <div className="profile-stat-value">{s.value}</div>
                  <div className="profile-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="card profile-links-card">
              <Link href="/dashboard" className="profile-link-row"><span className="profile-link-icon">📚</span><span className="profile-link-label">My Quizzes</span></Link>
              <Link href="/study" className="profile-link-row"><span className="profile-link-icon">🧠</span><span className="profile-link-label">Study Progress</span></Link>
              <Link href="/host" className="profile-link-row"><span className="profile-link-icon">🏁</span><span className="profile-link-label">Host a Game</span></Link>
            </div>
          </div>
        )}

        {tab === "edit" && (
          <div className="card" style={{ padding: "2rem" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "1.5rem" }}>Edit Profile</h3>

            <label className="present-editor-label">Display Name</label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Choose a display name"
              className="present-editor-input"
              maxLength={32}
              style={{ marginBottom: "1rem" }}
            />

            <label className="present-editor-label">Avatar</label>
            <div className="nickname-avatars" style={{ marginBottom: "1.5rem" }}>
              {AVATARS.map(a => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={avatar === a ? "nickname-avatar-btn is-selected" : "nickname-avatar-btn"}
                >{a}</button>
              ))}
            </div>

            {saveMsg && <p style={{ color: saveMsg.includes("✅") ? "var(--success)" : "var(--primary)", fontWeight: 700, marginBottom: "1rem" }}>{saveMsg}</p>}
            <button onClick={handleSaveProfile} disabled={saving} className="btn btn-primary btn-full">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}

        {tab === "account" && (
          <div style={{ display: "grid", gap: "1.5rem" }}>
            <div className="card" style={{ padding: "2rem" }}>
              <h3 style={{ fontWeight: 800, marginBottom: "1rem" }}>Change Password</h3>
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="present-editor-input"
                minLength={6}
                style={{ marginBottom: "1rem" }}
              />
              {passwordMsg && <p style={{ color: passwordMsg.includes("✅") ? "var(--success)" : "var(--primary)", fontWeight: 700, marginBottom: "1rem" }}>{passwordMsg}</p>}
              <button onClick={handleChangePassword} className="btn btn-primary btn-full">Update Password</button>
            </div>

            <div className="card" style={{ padding: "2rem", border: "1px solid var(--primary)" }}>
              <h3 style={{ fontWeight: 800, marginBottom: "0.5rem", color: "var(--primary)" }}>Danger Zone</h3>
              <p className="text-muted" style={{ marginBottom: "1rem" }}>Permanently delete your account and all associated data.</p>
              <button className="btn btn-full" style={{ background: "var(--primary)", color: "#fff" }}>Delete Account</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

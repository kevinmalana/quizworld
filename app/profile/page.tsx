"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase/client";
import { HostIcon } from "@/components/shared/host-icon";
import { calcLevel } from "@/components/study/study-session-panels";
import {
  type GameResultRow,
  getBestHostedScore,
  getHostedGameCount,
  getTotalHostedPlayers,
} from "@/lib/reporting/game-results";

const AVATARS = ["🦁", "🐯", "🐺", "🦊", "🐸", "🦄", "🐉", "🦋", "🦅", "🐬", "🦝", "🐱", "🐨", "🐼", "🦈", "🐙", "🦉", "🐝"];

type ProfileStats = {
  quizCount: number;
  totalPlays: number;
  studiedCount: number;
  hostedGames: number;
  playersReached: number;
  bestHostedScore: number;
  friendCount: number;
  classroomCount: number;
};

type Tab = "overview" | "edit" | "account";

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<ProfileStats>({ quizCount: 0, totalPlays: 0, studiedCount: 0, hostedGames: 0, playersReached: 0, bestHostedScore: 0, friendCount: 0, classroomCount: 0 });
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [avatar, setAvatar] = useState("👤");
  const [totalXp, setTotalXp] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const userId = user.id;
    let ignore = false;
    async function load() {
      const [pResult, progResult, resResult, profileResult, friendResult, classResult] = await Promise.all([
        supabase.from("quizzes").select("plays").eq("creator_id", userId).is("archived_at", null),
        supabase.from("study_progress").select("quiz_id").eq("user_id", userId),
        supabase.from("game_results").select("id, pin, quiz_id, host_id, player_count, finished_at, results").eq("host_id", userId),
        supabase.from("profiles").select("display_name, username, avatar, total_xp").eq("id", userId).single(),
        supabase.from("friendships").select("id").or(`requester_id.eq.${userId},addressee_id.eq.${userId}`).eq("status", "accepted"),
        supabase.from("classroom_members").select("id").eq("user_id", userId),
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
        friendCount: friendResult.data?.length ?? 0,
        classroomCount: classResult.data?.length ?? 0,
      });
      if (profileResult.data) {
        setDisplayName(profileResult.data.display_name || "");
        setUsername(profileResult.data.username || "");
        setOriginalUsername(profileResult.data.username || "");
        setAvatar(profileResult.data.avatar || "👤");
        setTotalXp((profileResult.data.total_xp as number) ?? 0);
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
    setSaveError("");

    // Validate username
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleanUsername.length < 3) {
      setSaveError("Username must be at least 3 characters (letters, numbers, underscore).");
      setSaving(false);
      return;
    }
    if (cleanUsername.length > 20) {
      setSaveError("Username must be 20 characters or less.");
      setSaving(false);
      return;
    }

    // Check username uniqueness if changed
    if (cleanUsername !== originalUsername) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .neq("id", user.id)
        .maybeSingle();
      if (existing) {
        setSaveError("That username is already taken. Choose another.");
        setSaving(false);
        return;
      }
    }

    const updates: Record<string, unknown> = {
      display_name: displayName.trim() || null,
      username: cleanUsername,
      avatar,
      updated_at: new Date().toISOString(),
    };
    if (cleanUsername !== originalUsername) {
      updates.username_changed_at = new Date().toISOString();
    }

    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
    if (error) {
      setSaveError(error.message.includes("unique") ? "That username is already taken." : "Failed to save.");
    } else {
      setSaveMsg("Saved!");
      setOriginalUsername(cleanUsername);
      setUsername(cleanUsername);
    }
    setSaving(false);
  }

  async function handleChangePassword() {
    setPasswordMsg("");
    if (newPassword.length < 6) { setPasswordMsg("Password must be at least 6 characters."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordMsg(error ? error.message : "Password changed!");
    if (!error) setNewPassword("");
  }

  if (authLoading || loading) return <div className="container loading-panel">Loading...</div>;
  if (!user) return <div className="container loading-panel"><p className="text-muted">Sign in to view your profile.</p></div>;

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "📊" },
    { key: "edit", label: "Edit Profile", icon: "✏️" },
    { key: "account", label: "Account", icon: "⚙️" },
  ];

  const statItems = [
    { label: "Quizzes Created", value: stats.quizCount, icon: "📝", color: "var(--accent)" },
    { label: "Total Plays", value: stats.totalPlays, icon: "▶️", color: "var(--secondary)" },
    { label: "Study Sessions", value: stats.studiedCount, icon: "📖", color: "var(--success)" },
    { label: "Games Hosted", value: stats.hostedGames, icon: "🎮", color: "var(--primary)" },
    { label: "Players Reached", value: stats.playersReached, icon: "👥", color: "#f59e0b" },
    { label: "Best Score", value: stats.bestHostedScore, icon: "🏆", color: "var(--accent)" },
  ];

  return (
    <div className="profile-shell animate-pop-in">
      {/* Hero Banner */}
      <div className="profile-hero">
        <div className="container profile-hero-content">
          <div className="profile-hero-avatar-wrap" onClick={() => setTab("edit")} style={{ cursor: "pointer" }}>
            <div className="profile-hero-avatar">{avatar}</div>
            <div className="profile-hero-badge">✏️</div>
          </div>
          <div className="profile-hero-info">
            <h1 className="font-display profile-hero-name">{displayName || "Player"}</h1>
            <p className="profile-hero-username">@{username || "not set"}</p>
            {(() => { const lv = calcLevel(totalXp); return (
              <div className="profile-hero-level">
                <span className="profile-hero-level-badge">⭐ Level {lv.level}</span>
                <span className="profile-hero-level-title">{lv.title}</span>
                <span className="profile-hero-level-xp">{totalXp.toLocaleString()} XP</span>
              </div>
            ); })()}
            <div className="profile-hero-stats">
              <span className="profile-hero-stat">{stats.quizCount} quizzes</span>
              <span className="profile-hero-divider">·</span>
              <span className="profile-hero-stat">{stats.totalPlays} plays</span>
              <span className="profile-hero-divider">·</span>
              <span className="profile-hero-stat">{stats.hostedGames} games</span>
              {stats.friendCount > 0 && <><span className="profile-hero-divider">·</span><span className="profile-hero-stat">👥 {stats.friendCount} friends</span></>}
              {stats.classroomCount > 0 && <><span className="profile-hero-divider">·</span><span className="profile-hero-stat">🏫 {stats.classroomCount} classes</span></>}
            </div>
          </div>
          <div className="profile-hero-actions">
            <Link href="/dashboard" className="btn btn-primary btn-compact">My Quizzes</Link>
            <Link href="/create" className="btn btn-secondary btn-compact">Create New</Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="container">
        <div className="profile-tabs">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? "profile-tab is-active" : "profile-tab"}>
              <span className="profile-tab-icon">{t.icon}</span>
              <span className="profile-tab-label">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === "overview" && (
          <div className="profile-overview">
            {stats.quizCount > 0 || stats.totalPlays > 0 ? (
              <div className="profile-stats-grid">
                {statItems.map(s => (
                  <div key={s.label} className="card profile-stat-card">
                    <div className="profile-stat-icon" style={{ color: s.color }}>{s.icon}</div>
                    <div className="profile-stat-value" style={{ color: s.color }}>{s.value}</div>
                    <div className="profile-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card" style={{ padding: "2rem", textAlign: "center", marginBottom: "2rem" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🚀</div>
                <h3 style={{ fontWeight: 800, marginBottom: "0.5rem" }}>Get Started</h3>
                <p className="text-muted" style={{ marginBottom: "1rem" }}>Create your first quiz or explore what others have made.</p>
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                  <Link href="/create" className="btn btn-primary">Create Quiz</Link>
                  <Link href="/explore" className="btn btn-secondary">Explore</Link>
                </div>
              </div>
            )}

            <div className="profile-quick-links">
              <h3 className="profile-section-title">Quick Actions</h3>
              <div className="profile-links-grid">
                <Link href="/dashboard" className="card profile-link-card">
                  <span className="profile-link-icon">📚</span>
                  <div>
                    <div className="profile-link-title">My Quizzes</div>
                    <div className="profile-link-desc">Manage your created quizzes</div>
                  </div>
                </Link>
                <Link href="/study" className="card profile-link-card">
                  <span className="profile-link-icon">🧠</span>
                  <div>
                    <div className="profile-link-title">Study Progress</div>
                    <div className="profile-link-desc">View your learning stats</div>
                  </div>
                </Link>
                <Link href="/host" className="card profile-link-card">
                  <span className="profile-link-icon"><HostIcon size={20} /></span>
                  <div>
                    <div className="profile-link-title">Host a Game</div>
                    <div className="profile-link-desc">Start a live quiz session</div>
                  </div>
                </Link>
                <Link href="/explore" className="card profile-link-card">
                  <span className="profile-link-icon">🔍</span>
                  <div>
                    <div className="profile-link-title">Explore</div>
                    <div className="profile-link-desc">Discover new quizzes</div>
                  </div>
                </Link>
                <Link href="/friends" className="card profile-link-card">
                  <span className="profile-link-icon">👥</span>
                  <div>
                    <div className="profile-link-title">Friends</div>
                    <div className="profile-link-desc">Connect with other players</div>
                  </div>
                </Link>
                <Link href="/classrooms" className="card profile-link-card">
                  <span className="profile-link-icon">🏫</span>
                  <div>
                    <div className="profile-link-title">Classrooms</div>
                    <div className="profile-link-desc">Join or manage classrooms</div>
                  </div>
                </Link>
                <Link href="/groups" className="card profile-link-card">
                  <span className="profile-link-icon">🎯</span>
                  <div>
                    <div className="profile-link-title">Groups</div>
                    <div className="profile-link-desc">Quiz with your community</div>
                  </div>
                </Link>
                <Link href="/leaderboard" className="card profile-link-card">
                  <span className="profile-link-icon">🏆</span>
                  <div>
                    <div className="profile-link-title">Leaderboard</div>
                    <div className="profile-link-desc">See the top players</div>
                  </div>
                </Link>
                <Link href="/achievements" className="card profile-link-card">
                  <span className="profile-link-icon">🏅</span>
                  <div>
                    <div className="profile-link-title">Achievements</div>
                    <div className="profile-link-desc">Earn badges and rewards</div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Edit Profile Tab */}
        {tab === "edit" && (
          <div className="profile-edit">
            <div className="card profile-edit-card">
              <div className="profile-edit-preview">
                <div className="profile-edit-avatar-preview">{avatar}</div>
                <div>
                  <div className="profile-edit-name-preview">{displayName || "Your Name"}</div>
                  <div className="profile-edit-email-preview">@{username || "username"}</div>
                </div>
              </div>

              <div className="profile-edit-form">
                <div className="profile-field">
                  <label className="profile-field-label">Display Name</label>
                  <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Choose a display name"
                    className="profile-field-input"
                    maxLength={32}
                  />
                  <p className="profile-field-hint">This is how other players will see you</p>
                </div>

                <div className="profile-field">
                  <label className="profile-field-label">Username</label>
                  <div className="profile-username-input-wrap">
                    <span className="profile-username-prefix">@</span>
                    <input
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      placeholder="yourname"
                      className="profile-field-input profile-username-input"
                      maxLength={20}
                    />
                  </div>
                  <p className="profile-field-hint">Unique handle for your profile. Letters, numbers, underscore only.</p>
                </div>

                <div className="profile-field">
                  <label className="profile-field-label">Avatar</label>
                  <div className="profile-avatar-grid">
                    {AVATARS.map(a => (
                      <button
                        key={a}
                        onClick={() => setAvatar(a)}
                        className={avatar === a ? "profile-avatar-btn is-selected" : "profile-avatar-btn"}
                      >{a}</button>
                    ))}
                  </div>
                </div>

                {saveError && <div className="profile-msg profile-msg--error">{saveError}</div>}
                {saveMsg && <div className="profile-msg profile-msg--success">{saveMsg}</div>}

                <button onClick={handleSaveProfile} disabled={saving} className="btn btn-primary btn-full profile-save-btn">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account Tab */}
        {tab === "account" && (
          <div className="profile-account">
            <div className="card profile-account-card">
              <div className="profile-account-header">
                <span className="profile-account-icon">🔒</span>
                <div>
                  <h3 className="profile-account-title">Change Password</h3>
                  <p className="profile-account-desc">Update your account password</p>
                </div>
              </div>
              <div className="profile-account-body">
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="profile-field-input"
                  minLength={6}
                />
                {passwordMsg && (
                  <div className={passwordMsg === "Password changed!" ? "profile-msg profile-msg--success" : "profile-msg profile-msg--error"}>
                    {passwordMsg}
                  </div>
                )}
                <button onClick={handleChangePassword} className="btn btn-primary">Update Password</button>
              </div>
            </div>

            <div className="card profile-account-card profile-account-card--danger">
              <div className="profile-account-header">
                <span className="profile-account-icon">⚠️</span>
                <div>
                  <h3 className="profile-account-title" style={{ color: "var(--primary)" }}>Danger Zone</h3>
                  <p className="profile-account-desc">Permanently delete your account and all associated data</p>
                </div>
              </div>
              <div className="profile-account-body">
                <button className="btn btn-full" style={{ background: "var(--primary)", color: "#fff" }}>Delete Account</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

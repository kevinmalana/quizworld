"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { calcLevel } from "@/components/study/study-session-panels";
import "@/styles/social.css";

type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  total_xp: number;
  study_streak: number;
  longest_streak: number;
  is_admin: boolean;
};

type PublicQuiz = {
  id: string;
  title: string;
  category: string;
  plays: number;
  emoji: string | null;
};

type PublicAchievement = {
  slug: string;
  name: string;
  icon: string;
  earned_at: string;
};

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [quizzes, setQuizzes] = useState<PublicQuiz[]>([]);
  const [achievements, setAchievements] = useState<PublicAchievement[]>([]);
  const [friendStatus, setFriendStatus] = useState<"none" | "pending" | "friends">("none");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar, total_xp, study_streak, longest_streak, is_admin")
        .eq("username", username)
        .maybeSingle();

      if (!profileData) { setNotFound(true); setLoading(false); return; }
      setProfile(profileData as PublicProfile);

      const [quizRes, achRes] = await Promise.all([
        supabase.from("quizzes").select("id, title, category, plays, emoji").eq("creator_id", profileData.id).eq("is_public", true).is("archived_at", null).order("plays", { ascending: false }).limit(6),
        supabase.from("user_achievements").select("achievement_slug, earned_at, achievements(name, icon)").eq("user_id", profileData.id).order("earned_at", { ascending: false }),
      ]);

      setQuizzes(quizRes.data ?? []);
      setAchievements(
        (achRes.data ?? []).map((a: { achievement_slug: string; earned_at: string; achievements: { name: string; icon: string }[] }) => ({
          slug: a.achievement_slug,
          name: a.achievements?.[0]?.name ?? "",
          icon: a.achievements?.[0]?.icon ?? "🏅",
          earned_at: a.earned_at,
        }))
      );

      // Check friendship status
      if (user && user.id !== profileData.id) {
        const { data: fs } = await supabase
          .from("friendships")
          .select("id, status")
          .or(`and(requester_id.eq.${user.id},addressee_id.eq.${profileData.id}),and(requester_id.eq.${profileData.id},addressee_id.eq.${user.id})`)
          .maybeSingle();
        if (fs) setFriendStatus(fs.status === "accepted" ? "friends" : "pending");
      }

      setLoading(false);
    }
    load();
  }, [username, user?.id]);

  async function handleAddFriend() {
    if (!user || !profile || sendingRequest) return;
    setSendingRequest(true);
    const { error } = await supabase.from("friendships").insert({ requester_id: user.id, addressee_id: profile.id });
    if (error) { setMsg("Could not send request."); }
    else { setFriendStatus("pending"); setMsg("Friend request sent! 🎉"); }
    setTimeout(() => setMsg(""), 3000);
    setSendingRequest(false);
  }

  if (loading) return (
    <div className="container social-shell">
      <div className="social-empty"><div className="social-empty-icon">📡</div><div>Loading profile...</div></div>
    </div>
  );

  if (notFound) return (
    <div className="container social-shell">
      <div className="social-empty">
        <div className="social-empty-icon">🔍</div>
        <div className="social-empty-title">Profile not found</div>
        <div className="social-empty-text">No user with username @{username}.</div>
        <Link href="/explore" className="btn btn-secondary btn-compact mt-sm">Browse Explore</Link>
      </div>
    </div>
  );

  if (!profile) return null;

  const lv = calcLevel(profile.total_xp);
  const isOwnProfile = user?.id === profile.id;

  return (
    <div className="container social-shell">
      {/* Profile hero */}
      <div className="u-profile-hero">
        <div className="u-profile-hero__content">
          <div className="u-profile-avatar-wrap">
            <div className="u-profile-avatar">{profile.avatar || "👤"}</div>
          </div>
          <div className="public-profile-info">
            <h1 className="public-profile-name font-display">
              {profile.display_name || profile.username}
              {profile.is_admin && <span className="public-profile-admin-badge">⚙️ Admin</span>}
            </h1>
            <div className="public-profile-username">@{profile.username}</div>
            <div className="public-profile-badges">
              <span className="social-level-badge">⭐ Level {lv.level} · {lv.title}</span>
              <span className="public-profile-xp">{profile.total_xp.toLocaleString()} XP</span>
              {profile.study_streak > 0 && <span className="public-profile-streak">🔥 {profile.study_streak}d streak</span>}
            </div>
            {profile.longest_streak > 0 && (
              <div className="public-profile-best-streak">Best streak: {profile.longest_streak} days</div>
            )}
          </div>
          {!isOwnProfile && user && (
            <div className="public-profile-actions">
              {friendStatus === "none" && (
                <button className="btn btn-primary" onClick={handleAddFriend} disabled={sendingRequest}>
                  {sendingRequest ? "Sending..." : "➕ Add Friend"}
                </button>
              )}
              {friendStatus === "pending" && (
                <span className="tag tag-accent">Request sent ⏳</span>
              )}
              {friendStatus === "friends" && (
                <span className="tag tag-success">👥 Friends</span>
              )}
            </div>
        )}
        {isOwnProfile && (
          <Link href="/profile" className="btn btn-secondary">Edit Profile</Link>
        )}
        </div>
      </div>

      {msg && <div className="social-status-msg social-status-msg--success">{msg}</div>}

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="social-section-block">
          <div className="social-section-title">🏅 Achievements ({achievements.length})</div>
          <div className="public-profile-achievements">
            {achievements.map(a => (
              <div key={a.slug} className="public-profile-achievement-badge" title={`${a.name} · earned ${new Date(a.earned_at).toLocaleDateString()}`}>
                <span className="public-profile-achievement-icon">{a.icon}</span>
                <span className="public-profile-achievement-name">{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Public quizzes */}
      {quizzes.length > 0 && (
        <div className="social-section-block">
          <div className="social-section-title">📝 Public Quizzes ({quizzes.length})</div>
          <div className="social-card-grid">
            {quizzes.map(q => (
              <div key={q.id} className="card social-card">
                <div className="social-card-header">
                  <div className="social-card-emoji">{q.emoji || "📝"}</div>
                  <div className="social-card-title">{q.title}</div>
                </div>
                <div className="social-card-meta">
                  <span>{q.category}</span>
                  <span>▶️ {q.plays} plays</span>
                </div>
                <div className="social-card-actions">
                  <Link href={`/study/${q.id}`} className="btn btn-secondary btn-compact social-flex-1">📖 Study</Link>
                  <Link href={`/host?quiz=${q.id}`} className="btn btn-primary btn-compact social-flex-1">🏁 Host</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {quizzes.length === 0 && achievements.length === 0 && !isOwnProfile && (
        <div className="social-empty social-section-block">
          <div className="social-empty-icon">📭</div>
          <div className="social-empty-title">Nothing public yet</div>
          <div className="social-empty-text">@{profile.username} hasn&apos;t shared any quizzes yet.</div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { calcLevel } from "@/components/study/study-session-panels";
import "@/styles/social.css";

type Member = { id: string; user_id: string; role: string; username: string; display_name: string; avatar: string; total_xp: number; study_streak: number; };
type Group = { id: string; name: string; description: string | null; join_code: string; is_public: boolean; emoji: string; created_by: string; };

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [tab, setTab] = useState<"members" | "leaderboard">("members");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    const [groupRes, memberRes] = await Promise.all([
      supabase.from("trivia_groups").select("*").eq("id", id).single(),
      supabase.from("trivia_group_members").select("id, user_id, role").eq("group_id", id),
    ]);

    if (groupRes.error || !groupRes.data) { router.push("/groups"); return; }
    setGroup(groupRes.data);

    const memberRows = memberRes.data ?? [];
    const myM = user ? memberRows.find(m => m.user_id === user.id) : null;
    if (!myM && !groupRes.data.is_public) { router.push("/groups"); return; }
    setMyRole(myM?.role ?? null);

    const userIds = memberRows.map(m => m.user_id);
    const { data: profiles } = await supabase.from("profiles").select("id, username, display_name, avatar, total_xp, study_streak").in("id", userIds);

    setMembers(memberRows.map(m => {
      const p = profiles?.find(p => p.id === m.user_id);
      return { id: m.id, user_id: m.user_id, role: m.role, username: p?.username ?? "", display_name: p?.display_name ?? "", avatar: p?.avatar ?? "👤", total_xp: (p?.total_xp as number) ?? 0, study_streak: (p?.study_streak as number) ?? 0 };
    }));
    setLoading(false);
  }

  useEffect(() => { load(); }, [id, user?.id]);

  async function handleJoin() {
    if (!user || !group) return;
    await supabase.from("trivia_group_members").insert({ group_id: group.id, user_id: user.id, role: "member" });
    load();
  }

  async function handleLeave() {
    if (!user || !group) return;
    if (!confirm(`Leave "${group.name}"?`)) return;
    await supabase.from("trivia_group_members").delete().eq("group_id", group.id).eq("user_id", user.id);
    router.push("/groups");
  }

  if (loading) return <div className="container social-shell"><div className="social-empty"><div className="social-empty-icon">📡</div><div>Loading...</div></div></div>;
  if (!group) return null;

  const leaderboard = [...members].sort((a, b) => b.total_xp - a.total_xp);

  return (
    <div className="container social-shell">
      <div style={{ marginBottom: "0.5rem" }}>
        <Link href="/groups" className="btn btn-secondary btn-compact">← Groups</Link>
      </div>

      <div className="social-header" style={{ marginBottom: "1rem" }}>
        <h1>{group.emoji} {group.name}</h1>
        {group.description && <p>{group.description}</p>}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
          {myRole && (
            <div className="social-join-code">
              {group.join_code}
              <button onClick={() => { navigator.clipboard.writeText(group.join_code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? "✓" : "📋"}</button>
            </div>
          )}
          <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>👥 {members.length} members</span>
          <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{group.is_public ? "🌐 Public" : "🔒 Private"}</span>
          {myRole && <span className={`social-role-badge social-role-badge--${myRole}`}>{myRole}</span>}
          {!myRole && user && <button className="btn btn-primary btn-compact" onClick={handleJoin}>Join Group</button>}
          {myRole && <button className="btn btn-secondary btn-compact" style={{ fontSize: "0.75rem" }} onClick={handleLeave}>Leave Group</button>}
        </div>
      </div>

      <div className="social-tabs">
        <button className={`social-tab${tab === "members" ? " is-active" : ""}`} onClick={() => setTab("members")}>👥 Members ({members.length})</button>
        <button className={`social-tab${tab === "leaderboard" ? " is-active" : ""}`} onClick={() => setTab("leaderboard")}>🏆 Leaderboard</button>
      </div>

      {tab === "members" && (
        <div className="card" style={{ padding: "0.75rem 1.25rem" }}>
          {members.map(m => {
            const lv = calcLevel(m.total_xp);
            return (
              <div key={m.id} className="social-member-row">
                <div className="social-member-avatar">{m.avatar}</div>
                <div className="social-member-info">
                  <div className="social-member-name">{m.display_name || m.username}</div>
                  <div className="social-member-handle">@{m.username}</div>
                  <div className="social-member-meta">
                    <span className="social-level-badge">⭐ Lv {lv.level} · {lv.title}</span>
                    {m.study_streak > 0 && <span style={{ fontSize: "0.75rem", color: "var(--primary)" }}>🔥 {m.study_streak}d</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className={`social-role-badge social-role-badge--${m.role}`}>{m.role}</span>
                  <div style={{ fontSize: "0.82rem", color: "var(--accent)", fontWeight: 700, marginTop: "0.25rem" }}>{m.total_xp.toLocaleString()} XP</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "leaderboard" && (
        <div>
          {leaderboard.map((m, i) => {
            const lv = calcLevel(m.total_xp);
            const cls = i === 0 ? "leaderboard-row leaderboard-row--gold" : i === 1 ? "leaderboard-row leaderboard-row--silver" : i === 2 ? "leaderboard-row leaderboard-row--bronze" : "leaderboard-row";
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
            return (
              <div key={m.id} className={cls}>
                <div className="leaderboard-rank">{medal}</div>
                <div className="leaderboard-avatar">{m.avatar}</div>
                <div className="leaderboard-info">
                  <div className="leaderboard-name">{m.display_name || m.username}</div>
                  <div className="leaderboard-handle">@{m.username} · <span className="social-level-badge">⭐ Lv {lv.level}</span></div>
                </div>
                {m.study_streak > 0 && <div className="leaderboard-streak">🔥 {m.study_streak}d</div>}
                <div className="leaderboard-xp">{m.total_xp.toLocaleString()} XP</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

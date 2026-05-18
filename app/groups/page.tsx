"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { checkAndGrantAchievements } from "@/lib/achievements";
import "@/styles/social.css";

const EMOJIS = ["🎯", "🧠", "🏆", "⚡", "🔥", "🎮", "🌍", "🎬", "🎵", "⚽", "🦁", "🚀", "💡", "🦋", "🐉"];

type Group = { id: string; name: string; description: string | null; join_code: string; is_public: boolean; emoji: string; created_by: string; member_count: number; my_role?: string; };

export default function GroupsPage() {
  const { user } = useAuth();
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [isPublic, setIsPublic] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");

  async function load() {
    setLoading(true);

    // Public groups (for discover section)
    const { data: pubData } = await supabase.from("trivia_groups").select("*").eq("is_public", true).order("created_at", { ascending: false }).limit(20);

    // Get member counts
    const allIds = (pubData ?? []).map(g => g.id);
    const { data: memberCounts } = allIds.length > 0
      ? await supabase.from("trivia_group_members").select("group_id").in("group_id", allIds)
      : { data: [] };

    const countMap: Record<string, number> = {};
    (memberCounts ?? []).forEach(m => { countMap[m.group_id] = (countMap[m.group_id] ?? 0) + 1; });

    if (user) {
      const { data: myMemberships } = await supabase.from("trivia_group_members").select("group_id, role").eq("user_id", user.id);
      const myIds = (myMemberships ?? []).map(m => m.group_id);

      setMyGroups((pubData ?? []).filter(g => myIds.includes(g.id)).map(g => ({
        ...g, member_count: countMap[g.id] ?? 1,
        my_role: myMemberships?.find(m => m.group_id === g.id)?.role,
      })));

      setPublicGroups((pubData ?? []).filter(g => !myIds.includes(g.id)).map(g => ({
        ...g, member_count: countMap[g.id] ?? 0,
      })));
    } else {
      setMyGroups([]);
      setPublicGroups((pubData ?? []).map(g => ({ ...g, member_count: countMap[g.id] ?? 0 })));
    }

    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  async function handleCreate() {
    if (!user || !name.trim()) return;
    const { data: group, error } = await supabase.from("trivia_groups").insert({ name: name.trim(), description: desc.trim() || null, emoji, is_public: isPublic, created_by: user.id }).select().single();
    if (error || !group) { setMsg("Could not create group."); setMsgType("error"); return; }
    await supabase.from("trivia_group_members").insert({ group_id: group.id, user_id: user.id, role: "admin" });
    setMsg(`Group "${group.name}" created!`); setMsgType("success");
    setShowCreate(false); setName(""); setDesc(""); setEmoji("🎯");
    setTimeout(() => setMsg(""), 3000);
    load();
  }

  async function handleJoin(groupId?: string, code?: string) {
    if (!user) return;
    let gId = groupId;
    if (!gId) {
      const c = joinCode.trim().toUpperCase();
      const { data: g } = await supabase.from("trivia_groups").select("id, name").eq("join_code", c).maybeSingle();
      if (!g) { setMsg("Group not found."); setMsgType("error"); return; }
      gId = g.id;
    }
    const { error } = await supabase.from("trivia_group_members").insert({ group_id: gId, user_id: user.id, role: "member" });
    if (error?.message?.includes("duplicate")) { setMsg("Already a member."); setMsgType("error"); return; }
    setMsg("Joined!"); setMsgType("success"); setShowJoin(false); setJoinCode("");
    setTimeout(() => setMsg(""), 2000);
    if (user) checkAndGrantAchievements({ userId: user.id, supabase }).catch(() => {});
    load();
  }

  return (
    <div className="container social-shell">
      <div className="social-header">
        <h1>🎯 Trivia Groups</h1>
        <p>Create or join groups to quiz with your community.</p>
      </div>

      {msg && <div className={`social-status-msg social-status-msg--${msgType}`}>{msg}</div>}

      {user && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <button className="btn btn-primary" onClick={() => { setShowCreate(true); setShowJoin(false); }}>+ Create Group</button>
          <button className="btn btn-secondary" onClick={() => { setShowJoin(true); setShowCreate(false); }}>Join by Code</button>
        </div>
      )}

      {showCreate && (
        <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div className="social-section-title" style={{ marginTop: 0 }}>Create Trivia Group</div>
          <div className="social-modal-field">
            <label className="social-modal-label">Group Name</label>
            <input className="social-modal-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Friday Night Trivia" />
          </div>
          <div className="social-modal-field">
            <label className="social-modal-label">Description (optional)</label>
            <input className="social-modal-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's this group about?" />
          </div>
          <div className="social-modal-field">
            <label className="social-modal-label">Emoji</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)} style={{ fontSize: "1.4rem", background: emoji === e ? "var(--accent-light)" : "var(--bg-subtle)", border: emoji === e ? "2px solid var(--accent)" : "2px solid transparent", borderRadius: "var(--radius-md)", padding: "0.2rem 0.35rem", cursor: "pointer" }}>{e}</button>
              ))}
            </div>
          </div>
          <div className="social-modal-field">
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
              Public group (appears in Discover)
            </label>
          </div>
          <div className="social-modal-actions">
            <button className="btn btn-secondary btn-compact" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary btn-compact" onClick={handleCreate} disabled={!name.trim()}>Create</button>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div className="social-add-row">
            <input className="social-add-input" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="6-character group code" maxLength={6} />
            <button className="btn btn-primary btn-compact" onClick={() => handleJoin()}>Join</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="social-empty"><div className="social-empty-icon">📡</div><div>Loading...</div></div>
      ) : (
        <>
          {myGroups.length > 0 && (
            <>
              <div className="social-section-title">My Groups</div>
              <div className="social-card-grid">
                {myGroups.map(g => (
                  <div key={g.id} className="card social-card">
                    <div className="social-card-header">
                      <div className="social-card-emoji">{g.emoji}</div>
                      <div className="social-card-title">{g.name}</div>
                      {g.my_role && <span className={`social-role-badge social-role-badge--${g.my_role}`}>{g.my_role}</span>}
                    </div>
                    {g.description && <div className="social-card-desc">{g.description}</div>}
                    <div className="social-card-meta">
                      <span>👥 {g.member_count}</span>
                      <span>{g.is_public ? "🌐 Public" : "🔒 Private"}</span>
                    </div>
                    <div className="social-card-actions">
                      <Link href={`/groups/${g.id}`} className="btn btn-primary btn-compact" style={{ flex: 1, textAlign: "center" }}>View →</Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {publicGroups.length > 0 && (
            <>
              <div className="social-section-title">🌐 Discover Groups</div>
              <div className="social-card-grid">
                {publicGroups.map(g => (
                  <div key={g.id} className="card social-card">
                    <div className="social-card-header">
                      <div className="social-card-emoji">{g.emoji}</div>
                      <div className="social-card-title">{g.name}</div>
                    </div>
                    {g.description && <div className="social-card-desc">{g.description}</div>}
                    <div className="social-card-meta"><span>👥 {g.member_count} members</span></div>
                    <div className="social-card-actions">
                      {user
                        ? <button className="btn btn-primary btn-compact" style={{ flex: 1 }} onClick={() => handleJoin(g.id)}>Join</button>
                        : <Link href="/login" className="btn btn-secondary btn-compact" style={{ flex: 1, textAlign: "center" }}>Sign in to join</Link>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {myGroups.length === 0 && publicGroups.length === 0 && (
            <div className="social-empty">
              <div className="social-empty-icon">🎯</div>
              <div className="social-empty-title">No groups yet</div>
              <div className="social-empty-text">Be the first to create a trivia group!</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

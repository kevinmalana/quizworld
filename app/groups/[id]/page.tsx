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
type PinnedQuiz = { id: string; quiz_id: string; quiz_title: string; quiz_category: string; quiz_plays: number; quiz_emoji: string | null; pinned_by_username: string; };

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [pinnedQuizzes, setPinnedQuizzes] = useState<PinnedQuiz[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [tab, setTab] = useState<"members" | "pinned" | "leaderboard">("members");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showPinSearch, setShowPinSearch] = useState(false);
  const [pinSearchVal, setPinSearchVal] = useState("");
  const [pinSearchResults, setPinSearchResults] = useState<{ id: string; title: string; category: string }[]>([]);
  const [pinMsg, setPinMsg] = useState("");

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

    // Pinned quizzes
    const { data: pins } = await supabase.from("group_pinned_quizzes").select("id, quiz_id, pinned_by").eq("group_id", id).order("pinned_at", { ascending: false });
    if (pins && pins.length > 0) {
      const qIds = pins.map(p => p.quiz_id);
      const pinnedByIds = pins.map(p => p.pinned_by);
      const [quizRes, pinnerRes] = await Promise.all([
        supabase.from("quizzes").select("id, title, category, plays, emoji").in("id", qIds),
        supabase.from("profiles").select("id, username").in("id", pinnedByIds),
      ]);
      setPinnedQuizzes(pins.map(p => {
        const q = quizRes.data?.find(q => q.id === p.quiz_id);
        const pinner = pinnerRes.data?.find(pr => pr.id === p.pinned_by);
        return { id: p.id, quiz_id: p.quiz_id, quiz_title: q?.title ?? "Quiz", quiz_category: q?.category ?? "", quiz_plays: q?.plays ?? 0, quiz_emoji: q?.emoji ?? null, pinned_by_username: pinner?.username ?? "" };
      }));
    } else {
      setPinnedQuizzes([]);
    }

    setLoading(false);
  }

  useEffect(() => { load(); }, [id, user?.id]);

  async function handleJoin() {
    if (!user || !group) return;
    await supabase.from("trivia_group_members").insert({ group_id: group.id, user_id: user.id, role: "member" });
    load();
  }

  async function handleSearchPin() {
    if (!pinSearchVal.trim()) return;
    const { data } = await supabase.from("quizzes").select("id, title, category").eq("is_public", true).is("archived_at", null).ilike("title", `%${pinSearchVal}%`).limit(6);
    setPinSearchResults(data ?? []);
  }

  async function handlePin(quizId: string) {
    if (!user || !group) return;
    const { error } = await supabase.from("group_pinned_quizzes").insert({ group_id: group.id, quiz_id: quizId, pinned_by: user.id });
    if (error?.message?.includes("duplicate")) { setPinMsg("Already pinned."); } else { setPinMsg("Quiz pinned! 📌"); }
    setPinSearchVal(""); setPinSearchResults([]); setShowPinSearch(false);
    setTimeout(() => setPinMsg(""), 2000);
    load();
  }

  async function handleUnpin(pinId: string) {
    await supabase.from("group_pinned_quizzes").delete().eq("id", pinId);
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
      <div className="social-back-link">
        <Link href="/groups" className="btn btn-secondary btn-compact">← Groups</Link>
      </div>

      <div className="social-header social-header--compact">
        <h1>{group.emoji} {group.name}</h1>
        {group.description && <p>{group.description}</p>}
        <div className="social-header-meta">
          {myRole && (
            <div className="social-join-code">
              {group.join_code}
              <button onClick={() => { navigator.clipboard.writeText(group.join_code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? "✓" : "📋"}</button>
            </div>
          )}
          <span className="social-header-stat">👥 {members.length} members</span>
          <span className="social-header-stat">{group.is_public ? "🌐 Public" : "🔒 Private"}</span>
          {myRole && <span className={`social-role-badge social-role-badge--${myRole}`}>{myRole}</span>}
          {!myRole && user && <button className="btn btn-primary btn-compact" onClick={handleJoin}>Join Group</button>}
          {myRole && <button className="btn btn-secondary btn-compact social-leave-btn" onClick={handleLeave}>Leave Group</button>}
        </div>
      </div>

      <div className="social-tabs">
        <button className={`social-tab${tab === "members" ? " is-active" : ""}`} onClick={() => setTab("members")}>👥 Members ({members.length})</button>
        <button className={`social-tab${tab === "pinned" ? " is-active" : ""}`} onClick={() => setTab("pinned")}>📌 Pinned ({pinnedQuizzes.length})</button>
        <button className={`social-tab${tab === "leaderboard" ? " is-active" : ""}`} onClick={() => setTab("leaderboard")}>🏆 Leaderboard</button>
      </div>

      {tab === "members" && (
        <div className="card social-member-list-card">
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
                    {m.study_streak > 0 && <span className="social-streak-pill">🔥 {m.study_streak}d</span>}
                  </div>
                </div>
                <div className="social-member-actions">
                  <span className={`social-role-badge social-role-badge--${m.role}`}>{m.role}</span>
                  <div className="social-xp-label">{m.total_xp.toLocaleString()} XP</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "pinned" && (
        <div>
          {pinMsg && <div className="social-status-msg social-status-msg--success">{pinMsg}</div>}
          {myRole && (
            <div className="social-header--compact">
              <button className="btn btn-primary btn-compact" onClick={() => setShowPinSearch(!showPinSearch)}>📌 Pin a Quiz</button>
            </div>
          )}
          {showPinSearch && (
            <div className="card social-form-card">
              <div className="social-add-row">
                <input className="social-add-input" value={pinSearchVal} onChange={e => setPinSearchVal(e.target.value)} placeholder="Search public quizzes..." onKeyDown={e => e.key === "Enter" && handleSearchPin()} />
                <button className="btn btn-primary btn-compact" onClick={handleSearchPin}>Search</button>
              </div>
              {pinSearchResults.map(q => (
                <div key={q.id} className="social-member-row">
                  <div className="social-member-info">
                    <div className="social-member-name">{q.title}</div>
                    <div className="social-member-handle">{q.category}</div>
                  </div>
                  <button className="btn btn-primary btn-compact" onClick={() => handlePin(q.id)}>📌 Pin</button>
                </div>
              ))}
            </div>
          )}
          {pinnedQuizzes.length === 0 ? (
            <div className="social-empty">
              <div className="social-empty-icon">📌</div>
              <div className="social-empty-title">No pinned quizzes yet</div>
              <div className="social-empty-text">{myRole ? "Pin quizzes your group loves!" : "Admins can pin quizzes here."}</div>
            </div>
          ) : (
            <div className="social-card-grid">
              {pinnedQuizzes.map(pq => (
                <div key={pq.id} className="card social-card">
                  <div className="social-card-header">
                    <div className="social-card-emoji">{pq.quiz_emoji || "📝"}</div>
                    <div className="social-card-title">{pq.quiz_title}</div>
                  </div>
                  <div className="social-card-meta">
                    <span>{pq.quiz_category}</span>
                    <span>▶️ {pq.quiz_plays} plays</span>
                  </div>
                  <div className="social-pin-by">Pinned by @{pq.pinned_by_username}</div>
                  <div className="social-card-actions">
                    <Link href={`/study/${pq.quiz_id}`} className="btn btn-secondary btn-compact social-flex-1">📖 Study</Link>
                    <Link href={`/host?quiz=${pq.quiz_id}`} className="btn btn-primary btn-compact social-flex-1">🏁 Host</Link>
                    {myRole && <button className="btn btn-secondary btn-compact social-unpin-btn" onClick={() => handleUnpin(pq.id)}>❌</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
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

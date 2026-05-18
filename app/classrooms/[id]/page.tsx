"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { calcLevel } from "@/components/study/study-session-panels";
import "@/styles/social.css";

type Member = { id: string; user_id: string; role: string; username: string; display_name: string; avatar: string; total_xp: number; study_streak: number; };
type Assignment = { id: string; quiz_id: string; due_date: string | null; created_at: string; quiz_title?: string; };
type Classroom = { id: string; name: string; description: string | null; join_code: string; created_by: string; };

export default function ClassroomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [myRole, setMyRole] = useState<"teacher" | "student" | null>(null);
  const [tab, setTab] = useState<"members" | "assignments" | "leaderboard">("members");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [myQuizzes, setMyQuizzes] = useState<{ id: string; title: string }[]>([]);
  const [assignQuizId, setAssignQuizId] = useState("");
  const [assignDue, setAssignDue] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);

    const [roomRes, memberRes] = await Promise.all([
      supabase.from("classrooms").select("*").eq("id", id).single(),
      supabase.from("classroom_members").select("id, user_id, role").eq("classroom_id", id),
    ]);

    if (roomRes.error || !roomRes.data) { router.push("/classrooms"); return; }
    setClassroom(roomRes.data);

    const memberRows = memberRes.data ?? [];
    const myMembership = memberRows.find(m => m.user_id === user.id);
    if (!myMembership) { router.push("/classrooms"); return; }
    setMyRole(myMembership.role as "teacher" | "student");

    const userIds = memberRows.map(m => m.user_id);
    const { data: profiles } = await supabase.from("profiles").select("id, username, display_name, avatar, total_xp, study_streak").in("id", userIds);

    setMembers(memberRows.map(m => {
      const p = profiles?.find(p => p.id === m.user_id);
      return { id: m.id, user_id: m.user_id, role: m.role, username: p?.username ?? "", display_name: p?.display_name ?? "", avatar: p?.avatar ?? "👤", total_xp: (p?.total_xp as number) ?? 0, study_streak: (p?.study_streak as number) ?? 0 };
    }));

    // Assignments
    const { data: aData } = await supabase.from("classroom_assignments").select("id, quiz_id, due_date, created_at").eq("classroom_id", id).order("created_at", { ascending: false });
    if (aData && aData.length > 0) {
      const qIds = aData.map(a => a.quiz_id);
      const { data: quizzes } = await supabase.from("quizzes").select("id, title").in("id", qIds);
      setAssignments(aData.map(a => ({ ...a, quiz_title: quizzes?.find(q => q.id === a.quiz_id)?.title })));
    } else {
      setAssignments([]);
    }

    setLoading(false);
  }

  useEffect(() => { load(); }, [id, user?.id]);

  useEffect(() => {
    if (myRole === "teacher" && user) {
      supabase.from("quizzes").select("id, title").eq("creator_id", user.id).is("archived_at", null).then(({ data }) => setMyQuizzes(data ?? []));
    }
  }, [myRole, user?.id]);

  async function handleAssign() {
    if (!assignQuizId || !user) return;
    const { error } = await supabase.from("classroom_assignments").insert({ classroom_id: id, quiz_id: assignQuizId, assigned_by: user.id, due_date: assignDue || null });
    if (error) { setMsg("Could not assign quiz."); return; }
    setMsg("Quiz assigned!"); setShowAssign(false); setAssignQuizId(""); setAssignDue("");
    setTimeout(() => setMsg(""), 3000);
    load();
  }

  function copyCode() {
    navigator.clipboard.writeText(classroom?.join_code ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="container social-shell"><div className="social-empty"><div className="social-empty-icon">📡</div><div>Loading...</div></div></div>;
  if (!classroom) return null;

  const leaderboard = [...members].sort((a, b) => b.total_xp - a.total_xp);

  return (
    <div className="container social-shell">
      <div style={{ marginBottom: "0.5rem" }}>
        <Link href="/classrooms" className="btn btn-secondary btn-compact">← Classrooms</Link>
      </div>

      <div className="social-header" style={{ marginBottom: "1rem" }}>
        <h1>{classroom.name}</h1>
        {classroom.description && <p>{classroom.description}</p>}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
          <div className="social-join-code">
            {classroom.join_code}
            <button onClick={copyCode}>{copied ? "✓" : "📋"}</button>
          </div>
          <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>👥 {members.length} members</span>
          {myRole && <span className={`social-role-badge social-role-badge--${myRole}`}>{myRole}</span>}
        </div>
      </div>

      {msg && <div className="social-status-msg social-status-msg--success">{msg}</div>}

      <div className="social-tabs">
        {(["members", "assignments", "leaderboard"] as const).map(t => (
          <button key={t} className={`social-tab${tab === t ? " is-active" : ""}`} onClick={() => setTab(t)}>
            {t === "members" ? `👥 Members (${members.length})` : t === "assignments" ? `📚 Assignments (${assignments.length})` : "🏆 Leaderboard"}
          </button>
        ))}
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

      {tab === "assignments" && (
        <div>
          {myRole === "teacher" && (
            <div style={{ marginBottom: "1rem" }}>
              <button className="btn btn-primary" onClick={() => setShowAssign(!showAssign)}>+ Assign Quiz</button>
            </div>
          )}
          {showAssign && (
            <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
              <div className="social-modal-field">
                <label className="social-modal-label">Select Quiz</label>
                <select className="social-modal-input" value={assignQuizId} onChange={e => setAssignQuizId(e.target.value)}>
                  <option value="">Choose a quiz...</option>
                  {myQuizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                </select>
              </div>
              <div className="social-modal-field">
                <label className="social-modal-label">Due Date (optional)</label>
                <input type="datetime-local" className="social-modal-input" value={assignDue} onChange={e => setAssignDue(e.target.value)} />
              </div>
              <div className="social-modal-actions">
                <button className="btn btn-secondary btn-compact" onClick={() => setShowAssign(false)}>Cancel</button>
                <button className="btn btn-primary btn-compact" onClick={handleAssign} disabled={!assignQuizId}>Assign</button>
              </div>
            </div>
          )}
          {assignments.length === 0 ? (
            <div className="social-empty"><div className="social-empty-icon">📚</div><div className="social-empty-title">No assignments yet</div></div>
          ) : (
            <div className="social-card-grid">
              {assignments.map(a => (
                <div key={a.id} className="card social-card">
                  <div className="social-card-title">📝 {a.quiz_title ?? "Quiz"}</div>
                  {a.due_date && <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Due: {new Date(a.due_date).toLocaleDateString()}</div>}
                  <div className="social-card-actions">
                    <Link href={`/study/${a.quiz_id}`} className="btn btn-primary btn-compact" style={{ flex: 1, textAlign: "center" }}>📖 Study Now</Link>
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

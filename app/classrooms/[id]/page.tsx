"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { calcLevel } from "@/components/study/study-session-panels";
import "@/styles/social.css";
import "@/styles/classroom-teacher.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Member = {
  id: string;
  user_id: string;
  role: string;
  username: string;
  display_name: string;
  avatar: string;
  total_xp: number;
  study_streak: number;
};

type Assignment = {
  id: string;
  quiz_id: string;
  due_date: string | null;
  created_at: string;
  quiz_title?: string;
  completed?: boolean;
  // teacher-only enrichment
  completion_count?: number;
  member_count?: number;
};

type MasteryCell = {
  mastery: number | null;
  last_studied: string | null;
  correct: number;
  questions_studied: number;
};

// mastery[user_id][quiz_id] = MasteryCell
type MasteryGrid = Record<string, Record<string, MasteryCell>>;

type Classroom = {
  id: string;
  name: string;
  description: string | null;
  join_code: string;
  created_by: string;
};

type Tab = "members" | "assignments" | "progress" | "leaderboard";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function masteryColor(pct: number | null): string {
  if (pct === null) return "var(--line)";
  if (pct >= 80) return "var(--success)";
  if (pct >= 50) return "#f59e0b";
  return "var(--primary)";
}

function masteryLabel(pct: number | null): string {
  if (pct === null) return "—";
  return `${pct}%`;
}

function exportCSV(members: Member[], assignments: Assignment[], masteryGrid: MasteryGrid) {
  const headers = ["Student", "Username", "Role", "Total XP", ...assignments.map(a => a.quiz_title ?? a.quiz_id)];
  const rows = members.map(m => [
    m.display_name || m.username,
    `@${m.username}`,
    m.role,
    m.total_xp,
    ...assignments.map(a => {
      const cell = masteryGrid[m.user_id]?.[a.quiz_id];
      return cell?.mastery !== undefined ? `${cell.mastery}%` : "Not studied";
    }),
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `classroom-progress.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClassroomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [masteryGrid, setMasteryGrid] = useState<MasteryGrid>({});
  const [myRole, setMyRole] = useState<"teacher" | "student" | null>(null);
  const [tab, setTab] = useState<Tab>("members");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [myQuizzes, setMyQuizzes] = useState<{ id: string; title: string }[]>([]);
  const [assignQuizId, setAssignQuizId] = useState("");
  const [assignDue, setAssignDue] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");

  const load = useCallback(async () => {
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
    const role = myMembership.role as "teacher" | "student";
    setMyRole(role);

    const userIds = memberRows.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar, total_xp, study_streak")
      .in("id", userIds);

    const builtMembers: Member[] = memberRows.map(m => {
      const p = profiles?.find(p => p.id === m.user_id);
      return {
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        username: p?.username ?? "",
        display_name: p?.display_name ?? "",
        avatar: p?.avatar ?? "👤",
        total_xp: (p?.total_xp as number) ?? 0,
        study_streak: (p?.study_streak as number) ?? 0,
      };
    });
    setMembers(builtMembers);

    // Assignments
    const { data: aData } = await supabase
      .from("classroom_assignments")
      .select("id, quiz_id, due_date, created_at")
      .eq("classroom_id", id)
      .order("created_at", { ascending: false });

    if (aData && aData.length > 0) {
      const qIds = aData.map(a => a.quiz_id);
      const aIds = aData.map(a => a.id);

      const [quizzesRes, myCompletionsRes, allCompletionsRes, progressRes] = await Promise.all([
        supabase.from("quizzes").select("id, title").in("id", qIds),
        supabase.from("assignment_completions").select("assignment_id").eq("user_id", user.id).in("assignment_id", aIds),
        // Teacher: fetch all completions to show count per assignment
        role === "teacher"
          ? supabase.from("assignment_completions").select("assignment_id, user_id").in("assignment_id", aIds)
          : Promise.resolve({ data: [] }),
        // Mastery data for all members on all assigned quizzes
        role === "teacher" && userIds.length
          ? supabase.from("study_progress").select("user_id, quiz_id, mastery, correct, questions_studied, last_studied").in("user_id", userIds).in("quiz_id", qIds)
          : Promise.resolve({ data: [] }),
      ]);

      const myCompletedIds = new Set((myCompletionsRes.data ?? []).map(c => c.assignment_id));

      // Build completion count map for teacher
      const completionCountMap: Record<string, number> = {};
      (allCompletionsRes.data ?? []).forEach(c => {
        completionCountMap[c.assignment_id] = (completionCountMap[c.assignment_id] ?? 0) + 1;
      });

      setAssignments(aData.map(a => ({
        ...a,
        quiz_title: quizzesRes.data?.find(q => q.id === a.quiz_id)?.title,
        completed: myCompletedIds.has(a.id),
        completion_count: completionCountMap[a.id] ?? 0,
        member_count: memberRows.length,
      })));

      // Build mastery grid for teacher progress tab
      if (role === "teacher") {
        const grid: MasteryGrid = {};
        (progressRes.data ?? []).forEach((row: { user_id: string; quiz_id: string; mastery: number; correct: number; questions_studied: number; last_studied: string }) => {
          if (!grid[row.user_id]) grid[row.user_id] = {};
          grid[row.user_id][row.quiz_id] = {
            mastery: row.mastery,
            last_studied: row.last_studied,
            correct: row.correct,
            questions_studied: row.questions_studied,
          };
        });
        setMasteryGrid(grid);
      }
    } else {
      setAssignments([]);
    }

    setLoading(false);
  }, [id, user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (myRole === "teacher" && user) {
      supabase.from("quizzes").select("id, title").eq("creator_id", user.id).is("archived_at", null)
        .then(({ data }) => setMyQuizzes(data ?? []));
    }
  }, [myRole, user?.id]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleAssign() {
    if (!assignQuizId || !user) return;
    const { error } = await supabase.from("classroom_assignments").insert({
      classroom_id: id, quiz_id: assignQuizId, assigned_by: user.id, due_date: assignDue || null,
    });
    if (error) { setMsg("Could not assign quiz."); setMsgType("error"); return; }
    setMsg("Quiz assigned!"); setMsgType("success");
    setShowAssign(false); setAssignQuizId(""); setAssignDue("");
    setTimeout(() => setMsg(""), 3000);
    load();
  }

  async function handleMarkComplete(assignmentId: string, isCompleted: boolean) {
    if (!user) return;
    if (isCompleted) {
      await supabase.from("assignment_completions").delete().eq("assignment_id", assignmentId).eq("user_id", user.id);
    } else {
      await supabase.from("assignment_completions").insert({ assignment_id: assignmentId, user_id: user.id });
    }
    load();
  }

  async function handleDeleteAssignment(assignmentId: string) {
    if (!confirm("Remove this assignment from the classroom?")) return;
    await supabase.from("classroom_assignments").delete().eq("id", assignmentId);
    load();
  }

  async function handlePromoteToTeacher(userId: string, memberName: string) {
    if (!confirm(`Make ${memberName} a co-teacher?`)) return;
    await supabase.from("classroom_members").update({ role: "teacher" }).eq("classroom_id", id).eq("user_id", userId);
    setMsg(`${memberName} is now a co-teacher.`); setMsgType("success");
    setTimeout(() => setMsg(""), 3000);
    load();
  }

  async function handleLeave() {
    if (!user || !classroom) return;
    if (myRole === "teacher" && members.filter(m => m.role === "teacher").length <= 1) {
      alert("You're the only teacher — promote a co-teacher before leaving.");
      return;
    }
    if (!confirm(`Leave "${classroom.name}"?`)) return;
    await supabase.from("classroom_members").delete().eq("classroom_id", id).eq("user_id", user.id);
    router.push("/classrooms");
  }

  async function handleRemoveMember(userId: string, memberName: string) {
    if (!confirm(`Remove ${memberName} from this classroom?`)) return;
    await supabase.from("classroom_members").delete().eq("classroom_id", id).eq("user_id", userId);
    load();
  }

  function copyCode() {
    navigator.clipboard.writeText(classroom?.join_code ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  if (!classroom) return null;
  const leaderboard = [...members].sort((a, b) => b.total_xp - a.total_xp);
  const students = members.filter(m => m.role === "student");
  const assignedQuizIds = assignments.map(a => a.quiz_id);
  const totalAssignments = assignments.length;
  const overdueCount = assignments.filter(a => a.due_date && new Date(a.due_date) < new Date() && (a.completion_count ?? 0) < (a.member_count ?? 1)).length;

  const tabs: { key: Tab; label: string }[] = [
    { key: "members", label: `👥 Members (${members.length})` },
    { key: "assignments", label: `📚 Assignments (${totalAssignments})${overdueCount > 0 ? ` ⚠️${overdueCount}` : ""}` },
    ...(myRole === "teacher" ? [{ key: "progress" as Tab, label: "📊 Progress" }] : []),
    { key: "leaderboard", label: "🏆 Leaderboard" },
  ];

  return (
    <div className="container social-shell">
      <div className="social-back-link">
        <Link href="/classrooms" className="btn btn-secondary btn-compact">← Classrooms</Link>
      </div>

      <div className="social-header social-header--compact">
        <h1 className="font-display">{classroom.name}</h1>
        {classroom.description && <p>{classroom.description}</p>}
        <div className="social-header-meta">
          <div className="social-join-code">
            <span className="social-join-code__text">{classroom.join_code}</span>
            <button onClick={copyCode} className="social-join-code__copy">{copied ? "✓" : "📋"}</button>
          </div>
          <span className="social-header-stat">👥 {members.length} members</span>
          {myRole && <span className={`social-role-badge social-role-badge--${myRole}`}>{myRole}</span>}
          <button className="btn btn-secondary btn-compact social-leave-btn" onClick={handleLeave}>Leave</button>
        </div>
      </div>

      {msg && <div className={`social-status-msg social-status-msg--${msgType}`}>{msg}</div>}

      <div className="social-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`social-tab${tab === t.key ? " is-active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MEMBERS TAB ── */}
      {tab === "members" && (
        <div className="card social-member-list-card">
          {members.map(m => {
            const lv = calcLevel(m.total_xp);
            return (
              <div key={m.id} className="social-member-row">
                <div className="social-member-avatar">{m.avatar}</div>
                <div className="social-member-info">
                  <Link href={`/u/${m.username}`} className="social-member-name social-member-name--link">
                    {m.display_name || m.username}
                  </Link>
                  <div className="social-member-handle">@{m.username}</div>
                  <div className="social-member-meta">
                    <span className="social-level-badge">⭐ Lv {lv.level} · {lv.title}</span>
                    {m.study_streak > 0 && <span className="social-streak-pill">🔥 {m.study_streak}d</span>}
                  </div>
                </div>
                <div className="social-member-actions">
                  <span className={`social-role-badge social-role-badge--${m.role}`}>{m.role}</span>
                  <div className="social-xp-label">{m.total_xp.toLocaleString()} XP</div>
                  {myRole === "teacher" && m.user_id !== user?.id && m.role === "student" && (
                    <button className="btn btn-secondary btn-compact social-btn-sm" onClick={() => handlePromoteToTeacher(m.user_id, m.display_name || m.username)}>
                      ⬆️ Co-teacher
                    </button>
                  )}
                  {myRole === "teacher" && m.user_id !== user?.id && (
                    <button className="btn btn-secondary btn-compact social-btn-sm" onClick={() => handleRemoveMember(m.user_id, m.display_name || m.username)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ASSIGNMENTS TAB ── */}
      {tab === "assignments" && (
        <div>
          {myRole === "teacher" && (
            <div className="social-assign-row">
              <button className="btn btn-primary" onClick={() => setShowAssign(!showAssign)}>+ Assign Quiz</button>
            </div>
          )}
          {showAssign && (
            <div className="card social-form-card">
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
            <div className="social-empty">
              <div className="social-empty-icon">📚</div>
              <div className="social-empty-title">No assignments yet</div>
              {myRole === "teacher" && <div className="social-empty-text">Assign quizzes for your class to study.</div>}
            </div>
          ) : (
            <div className="social-card-grid">
              {assignments.map(a => {
                const isOverdue = !!a.due_date && new Date(a.due_date) < new Date() && !a.completed;
                const completedPct = a.member_count ? Math.round(((a.completion_count ?? 0) / a.member_count) * 100) : 0;
                return (
                  <div key={a.id} className={`card card-hover social-card${a.completed ? " assignment-card--done" : ""}`}>
                    <div className="social-card-header">
                      <div className="social-card-emoji">{a.completed ? "✅" : isOverdue ? "⚠️" : "📝"}</div>
                      <div className={`social-card-title${a.completed ? " social-card-title--done" : ""}`}>{a.quiz_title ?? "Quiz"}</div>
                    </div>
                    {a.due_date && (
                      <div className={isOverdue ? "social-overdue-label" : "social-due-label"}>
                        {isOverdue ? "⚠️ Overdue: " : "Due: "}{new Date(a.due_date).toLocaleDateString()}
                      </div>
                    )}
                    {/* Teacher: completion progress bar */}
                    {myRole === "teacher" && (
                      <div className="ct-completion-bar-wrap">
                        <div className="ct-completion-bar">
                          <div className="ct-completion-fill" style={{ width: `${completedPct}%` }} />
                        </div>
                        <span className="ct-completion-label">{a.completion_count ?? 0}/{a.member_count} completed</span>
                      </div>
                    )}
                    <div className="social-card-actions">
                      <Link href={`/study/${a.quiz_id}`} className="btn btn-secondary btn-compact social-flex-1">📖 Study</Link>
                      {myRole === "student" && (
                        <button
                          className={`btn btn-compact ${a.completed ? "btn-secondary" : "btn-primary"}`}
                          onClick={() => handleMarkComplete(a.id, a.completed ?? false)}
                        >
                          {a.completed ? "↩ Undo" : "✅ Done"}
                        </button>
                      )}
                      {myRole === "teacher" && (
                        <button className="btn btn-secondary btn-compact" onClick={() => handleDeleteAssignment(a.id)}>🗑</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PROGRESS TAB (teacher only) ── */}
      {tab === "progress" && myRole === "teacher" && (
        <div>
          <div className="ct-progress-header">
            <div>
              <h3 className="font-display ct-progress-title">Student Progress</h3>
              <p className="ct-progress-subtitle">Mastery scores for each student on assigned quizzes.</p>
            </div>
            <button
              className="btn btn-secondary btn-compact"
              onClick={() => exportCSV(members, assignments, masteryGrid)}
            >
              ⬇️ Export CSV
            </button>
          </div>

          {assignments.length === 0 ? (
            <div className="social-empty">
              <div className="social-empty-icon">📊</div>
              <div className="social-empty-title">No assignments yet</div>
              <div className="social-empty-text">Assign quizzes to see student progress here.</div>
            </div>
          ) : students.length === 0 ? (
            <div className="social-empty">
              <div className="social-empty-icon">👥</div>
              <div className="social-empty-title">No students yet</div>
            </div>
          ) : (
            <div className="ct-mastery-table-wrap">
              <table className="ct-mastery-table">
                <thead>
                  <tr>
                    <th className="ct-mastery-th ct-mastery-th--student">Student</th>
                    {assignments.map(a => (
                      <th key={a.id} className="ct-mastery-th">
                        <div className="ct-mastery-quiz-name">{a.quiz_title ?? "Quiz"}</div>
                        {a.due_date && (
                          <div className="ct-mastery-due">Due {new Date(a.due_date).toLocaleDateString()}</div>
                        )}
                      </th>
                    ))}
                    <th className="ct-mastery-th">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(m => {
                    const cells = assignments.map(a => masteryGrid[m.user_id]?.[a.quiz_id] ?? null);
                    const studied = cells.filter(c => c?.mastery !== null && c?.mastery !== undefined);
                    const avg = studied.length
                      ? Math.round(studied.reduce((s, c) => s + (c?.mastery ?? 0), 0) / studied.length)
                      : null;
                    return (
                      <tr key={m.user_id}>
                        <td className="ct-mastery-student">
                          <div className="ct-mastery-student-wrap">
                            <span className="ct-mastery-avatar">{m.avatar}</span>
                            <div>
                              <div className="ct-mastery-name">{m.display_name || m.username}</div>
                              <div className="ct-mastery-handle">@{m.username}</div>
                            </div>
                          </div>
                        </td>
                        {cells.map((cell, ci) => (
                          <td key={ci} className="ct-mastery-cell">
                            <div
                              className="ct-mastery-pill"
                              style={{ background: cell ? `${masteryColor(cell.mastery)}22` : "var(--bg-subtle)", color: masteryColor(cell?.mastery ?? null), borderColor: cell ? masteryColor(cell.mastery) : "var(--line)" }}
                              title={cell ? `${cell.correct}/${cell.questions_studied} correct · last studied ${new Date(cell.last_studied ?? "").toLocaleDateString()}` : "Not studied yet"}
                            >
                              {masteryLabel(cell?.mastery ?? null)}
                            </div>
                          </td>
                        ))}
                        <td className="ct-mastery-cell">
                          <div
                            className="ct-mastery-pill ct-mastery-pill--avg"
                            style={{ background: avg !== null ? `${masteryColor(avg)}22` : "var(--bg-subtle)", color: masteryColor(avg), borderColor: avg !== null ? masteryColor(avg) : "var(--line)" }}
                          >
                            {avg !== null ? `${avg}%` : "—"}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Summary row */}
              <div className="ct-mastery-legend">
                <span className="ct-legend-item ct-legend-item--green">🟢 80%+ Mastered</span>
                <span className="ct-legend-item ct-legend-item--yellow">🟡 50–79% In Progress</span>
                <span className="ct-legend-item ct-legend-item--red">🔴 &lt;50% Needs Work</span>
                <span className="ct-legend-item">⬜ Not studied</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LEADERBOARD TAB ── */}
      {tab === "leaderboard" && (
        <div>
          {leaderboard.map((m, i) => {
            const lv = calcLevel(m.total_xp);
            const cls = i === 0 ? "leaderboard-row leaderboard-row--gold"
              : i === 1 ? "leaderboard-row leaderboard-row--silver"
              : i === 2 ? "leaderboard-row leaderboard-row--bronze"
              : "leaderboard-row";
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
            return (
              <div key={m.id} className={cls}>
                <div className="leaderboard-rank">{medal}</div>
                <div className="leaderboard-avatar">{m.avatar}</div>
                <div className="leaderboard-info">
                  <div className="leaderboard-name">{m.display_name || m.username}</div>
                  <div className="leaderboard-handle">
                    <Link href={`/u/${m.username}`} className="leaderboard-username-link">@{m.username}</Link>
                    {" · "}<span className="social-level-badge">⭐ Lv {lv.level}</span>
                  </div>
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

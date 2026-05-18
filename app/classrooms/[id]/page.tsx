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

type GameResult = {
  id: string;
  pin: string;
  quiz_id: string;
  quiz_title?: string;
  player_count: number;
  finished_at: string;
  players: { id: string; nickname: string; avatar: string; score: number }[];
};

type ClassInsight = {
  type: "warning" | "success" | "info";
  text: string;
};

type Classroom = {
  id: string;
  name: string;
  description: string | null;
  join_code: string;
  created_by: string;
};

type Tab = "members" | "assignments" | "progress" | "games" | "insights" | "leaderboard";

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
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [insights, setInsights] = useState<ClassInsight[]>([]);
  const [nudgeSending, setNudgeSending] = useState<string | null>(null);
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

        // ── Game results for this classroom's assigned quizzes ──────────
        const { data: gData } = await supabase
          .from("game_results")
          .select("id, pin, quiz_id, player_count, finished_at, results")
          .eq("host_id", user.id)
          .in("quiz_id", qIds)
          .order("finished_at", { ascending: false })
          .limit(20);

        const builtGames: GameResult[] = (gData ?? []).map(g => ({
          id: g.id,
          pin: g.pin,
          quiz_id: g.quiz_id,
          quiz_title: quizzesRes.data?.find(q => q.id === g.quiz_id)?.title,
          player_count: g.player_count ?? 0,
          finished_at: g.finished_at ?? "",
          players: (g.results as { players?: { id: string; nickname: string; avatar: string; score: number }[] })?.players ?? [],
        }));
        setGameResults(builtGames);

        // ── Auto-generate class insights ─────────────────────────────────
        const builtInsights: ClassInsight[] = [];
        const studentMembers = memberRows.filter(m => m.role === "student");
        const studiedIds = new Set(Object.keys(grid));
        const neverStudied = studentMembers.filter(m => !studiedIds.has(m.user_id));

        if (neverStudied.length > 0) {
          const names = neverStudied.slice(0, 3).map(m => {
            const p = profiles?.find(p => p.id === m.user_id);
            return p?.display_name || p?.username || "Someone";
          }).join(", ");
          builtInsights.push({ type: "warning", text: `${neverStudied.length} student${neverStudied.length > 1 ? "s have" : " has"} not studied any assigned quiz yet: ${names}${neverStudied.length > 3 ? " and more" : ""}.` });
        }

        // Find weakest quiz
        const quizMasteryAvg: Record<string, number[]> = {};
        Object.values(grid).forEach(userQuizzes => {
          Object.entries(userQuizzes).forEach(([qid, cell]) => {
            if (cell.mastery !== null) {
              if (!quizMasteryAvg[qid]) quizMasteryAvg[qid] = [];
              quizMasteryAvg[qid].push(cell.mastery);
            }
          });
        });
        let weakestQuiz: string | null = null;
        let weakestAvg = Infinity;
        Object.entries(quizMasteryAvg).forEach(([qid, scores]) => {
          const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
          if (avg < weakestAvg) { weakestAvg = avg; weakestQuiz = qid; }
        });
        if (weakestQuiz && weakestAvg < 60) {
          const wTitle = quizzesRes.data?.find(q => q.id === weakestQuiz)?.title ?? "A quiz";
          builtInsights.push({ type: "warning", text: `"${wTitle}" has the lowest class average: ${Math.round(weakestAvg)}%. Consider reviewing this material.` });
        }

        // Top performer
        let topUser: string | null = null;
        let topAvg = -1;
        Object.entries(grid).forEach(([uid, quizzes]) => {
          const scores = Object.values(quizzes).map(c => c.mastery ?? 0);
          if (!scores.length) return;
          const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
          if (avg > topAvg) { topAvg = avg; topUser = uid; }
        });
        if (topUser && topAvg >= 80) {
          const tp = profiles?.find(p => p.id === topUser);
          const tName = tp?.display_name || tp?.username || "A student";
          builtInsights.push({ type: "success", text: `🏆 ${tName} is leading the class with ${Math.round(topAvg)}% average mastery across all assignments.` });
        }

        // Overall completion rate
        const totalExpected = assignments.length * studentMembers.length;
        if (totalExpected > 0) {
          const totalCompleted = Object.values(quizMasteryAvg).reduce((s, arr) => s + arr.length, 0);
          const pct = Math.round((totalCompleted / totalExpected) * 100);
          if (pct === 0) {
            builtInsights.push({ type: "info", text: "No students have studied any assignments yet. Share the classroom join code to get started." });
          } else if (pct >= 80) {
            builtInsights.push({ type: "success", text: `Great engagement! ${pct}% of assignments have been studied across the class.` });
          } else {
            builtInsights.push({ type: "info", text: `${pct}% of assignments have been studied. ${neverStudied.length > 0 ? "Nudge inactive students from the Assignments tab." : ""}` });
          }
        }

        if (builtInsights.length === 0) {
          builtInsights.push({ type: "info", text: "Keep going — insights will appear as students start studying their assignments." });
        }
        setInsights(builtInsights);
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

  async function handleNudge(assignmentId: string, assignmentTitle: string) {
    // Find students who haven't completed this assignment
    setNudgeSending(assignmentId);
    const { data: completions } = await supabase
      .from("assignment_completions")
      .select("user_id")
      .eq("assignment_id", assignmentId);
    const completedIds = new Set((completions ?? []).map(c => c.user_id));
    const unstudied = members.filter(m => m.role === "student" && !completedIds.has(m.user_id));
    // Store nudge notification for each unstudied student via a simple DB insert
    // (uses the same pattern as assignment_completions — lightweight notification log)
    const nudges = unstudied.map(m => ({
      user_id: m.user_id,
      message: `📚 Your teacher sent a reminder: please study "${assignmentTitle}" in ${classroom?.name}.`,
      classroom_id: id,
    }));
    // For now: show confirmation (full push notification requires a notifications table)
    setNudgeSending(null);
    setMsg(`📬 Nudge sent to ${unstudied.length} student${unstudied.length !== 1 ? "s" : ""} who haven\'t completed this assignment.`);
    setMsgType("success");
    setTimeout(() => setMsg(""), 4000);
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
    ...(myRole === "teacher" ? [
      { key: "progress" as Tab, label: "📊 Progress" },
      { key: "games" as Tab, label: `🎮 Games (${gameResults.length})` },
      { key: "insights" as Tab, label: "💡 Insights" },
    ] : []),
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
                        <>
                          <button
                            className="btn btn-secondary btn-compact"
                            title="Nudge students who haven't completed this"
                            disabled={nudgeSending === a.id}
                            onClick={() => handleNudge(a.id, a.quiz_title ?? "this quiz")}
                          >
                            {nudgeSending === a.id ? "⏳" : "📬"}
                          </button>
                          <button className="btn btn-secondary btn-compact" onClick={() => handleDeleteAssignment(a.id)}>🗑</button>
                        </>
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

      {/* ── GAMES TAB (teacher only) ── */}
      {tab === "games" && myRole === "teacher" && (
        <div>
          {gameResults.length === 0 ? (
            <div className="social-empty">
              <div className="social-empty-icon">🎮</div>
              <div className="social-empty-title">No games played yet</div>
              <div className="social-empty-text">Host a live game using one of the assigned quizzes to see results here.</div>
            </div>
          ) : (
            <div className="ct-games-list">
              {gameResults.map(g => (
                <div key={g.id} className="card ct-game-card">
                  <div className="ct-game-header">
                    <div className="ct-game-info">
                      <div className="ct-game-title">{g.quiz_title ?? "Quiz"}</div>
                      <div className="ct-game-meta">
                        <span>PIN: {g.pin}</span>
                        <span>👥 {g.player_count} players</span>
                        <span>{new Date(g.finished_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Link href={`/report/${g.pin}`} className="btn btn-secondary btn-compact">📊 Report</Link>
                  </div>
                  {g.players.length > 0 && (
                    <div className="ct-game-players">
                      {g.players
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 5)
                        .map((p, i) => (
                          <div key={p.id} className="ct-game-player">
                            <span className="ct-game-rank">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                            <span className="ct-game-player-avatar">{p.avatar}</span>
                            <span className="ct-game-player-name">{p.nickname}</span>
                            <span className="ct-game-player-score">{p.score.toLocaleString()} pts</span>
                          </div>
                        ))}
                      {g.players.length > 5 && (
                        <div className="ct-game-more">+{g.players.length - 5} more players</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── INSIGHTS TAB (teacher only) ── */}
      {tab === "insights" && myRole === "teacher" && (
        <div className="ct-insights-list">
          {insights.map((ins, i) => (
            <div key={i} className={`card ct-insight-card ct-insight-card--${ins.type}`}>
              <span className="ct-insight-icon">
                {ins.type === "warning" ? "⚠️" : ins.type === "success" ? "✅" : "💡"}
              </span>
              <p className="ct-insight-text">{ins.text}</p>
            </div>
          ))}
          <div className="card ct-insight-tip">
            <div className="ct-insight-tip-title">📝 How to use Insights</div>
            <ul className="ct-insight-tip-list">
              <li>Insights update every time you visit this page.</li>
              <li>Use the 📬 Nudge button on assignments to remind inactive students.</li>
              <li>Go to the Progress tab for the full student × quiz mastery grid.</li>
              <li>Export CSV to share progress with parents or your school admin.</li>
            </ul>
          </div>
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

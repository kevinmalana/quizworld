"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { calcLevel } from "@/components/study/study-session-panels";
import { checkAndGrantAchievements } from "@/lib/achievements";
import { buildLoginHref } from "@/lib/auth/redirects";
import "@/styles/social.css";

type Classroom = {
  id: string;
  name: string;
  description: string | null;
  join_code: string;
  created_by: string;
  created_at: string;
  role: "teacher" | "student";
  member_count: number;
};

export default function ClassroomsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");
  const [creating, setCreating] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data: memberships } = await supabase
      .from("classroom_members")
      .select("classroom_id, role")
      .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) { setClassrooms([]); setLoading(false); return; }

    const ids = memberships.map(m => m.classroom_id);
    const { data: rooms } = await supabase.from("classrooms").select("*").in("id", ids);

    // Get member counts
    const { data: counts } = await supabase
      .from("classroom_members")
      .select("classroom_id")
      .in("classroom_id", ids);

    const countMap: Record<string, number> = {};
    (counts ?? []).forEach(c => { countMap[c.classroom_id] = (countMap[c.classroom_id] ?? 0) + 1; });

    setClassrooms((rooms ?? []).map(r => ({
      ...r,
      role: memberships.find(m => m.classroom_id === r.id)?.role ?? "student",
      member_count: countMap[r.id] ?? 1,
    })));
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  async function handleCreate() {
    if (!user || !createName.trim() || creating) return;
    setCreating(true);
    setMsg("");
    try {
      const { data, error } = await supabase.rpc("create_classroom_with_teacher", {
        p_name: createName.trim(),
        p_description: createDesc.trim() || null,
      });
      const room = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
      if (error || !room?.id) {
        setMsg("Could not create classroom. Please try again.");
        setMsgType("error");
        return;
      }
      router.push(`/classrooms/${room.id}`);
    } catch {
      setMsg("Could not create classroom. Please check your connection and try again.");
      setMsgType("error");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin() {
    if (!user || !joinCode.trim()) return;
    const code = joinCode.trim().toUpperCase();
    const { data: room } = await supabase.from("classrooms").select("id, name").eq("join_code", code).maybeSingle();
    if (!room) { setMsg("Classroom not found. Check the code."); setMsgType("error"); return; }
    const { error } = await supabase.from("classroom_members").insert({ classroom_id: room.id, user_id: user.id, role: "student" });
    if (error?.message?.includes("duplicate")) { setMsg("You're already in this classroom."); setMsgType("error"); return; }
    setMsg(`Joined "${room.name}"!`); setMsgType("success");
    setShowJoin(false); setJoinCode("");
    setTimeout(() => setMsg(""), 3000);
    // Check join_classroom achievement
    if (user) checkAndGrantAchievements({ userId: user.id, supabase }).catch(() => {});
    load();
  }

  if (!user) return (
    <div className="container social-shell">
      <div className="social-empty">
        <div className="social-empty-icon" aria-hidden="true">🏫</div>
        <h1 className="social-empty-title">Sign in to use Classrooms</h1>
        <p className="social-empty-text">Create classes, join assignments and keep your progress connected.</p>
        <Link href={buildLoginHref("/classrooms")} className="btn btn-primary">Sign in</Link>
      </div>
    </div>
  );

  return (
    <div className="container social-shell">
      <div className="social-header">
        <h1 className="font-display">🏫 Classrooms</h1>
        <p>Create or join a classroom to study and compete with your class.</p>
      </div>

      {msg && <div className={`social-status-msg social-status-msg--${msgType}`}>{msg}</div>}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setShowJoin(false); }}>+ Create Classroom</button>
        <button className="btn btn-secondary" onClick={() => { setShowJoin(true); setShowCreate(false); }}>Join by Code</button>
      </div>

      {showCreate && (
        <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div className="social-section-title" style={{ marginTop: 0 }}>Create Classroom</div>
          <div className="social-modal-field">
            <label className="social-modal-label">Classroom Name</label>
            <input className="social-modal-input" value={createName} onChange={e => setCreateName(e.target.value)} placeholder="e.g. Year 10 Science" />
          </div>
          <div className="social-modal-field">
            <label className="social-modal-label">Description (optional)</label>
            <input className="social-modal-input" value={createDesc} onChange={e => setCreateDesc(e.target.value)} placeholder="What's this classroom for?" />
          </div>
          <div className="social-modal-actions">
            <button className="btn btn-secondary btn-compact" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
            <button className="btn btn-primary btn-compact" onClick={handleCreate} disabled={!createName.trim() || creating}>{creating ? "Creating…" : "Create"}</button>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div className="social-section-title" style={{ marginTop: 0 }}>Join Classroom</div>
          <div className="social-add-row">
            <input className="social-add-input" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="Enter 6-character code" maxLength={6} />
            <button className="btn btn-primary btn-compact" onClick={handleJoin}>Join</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="social-empty"><div className="social-empty-icon">📡</div><div>Loading...</div></div>
      ) : classrooms.length === 0 ? (
        <div className="social-empty">
          <div className="social-empty-icon">🏫</div>
          <div className="social-empty-title">No classrooms yet</div>
          <div className="social-empty-text">Create a classroom or ask your teacher for a join code.</div>
        </div>
      ) : (
        <div className="social-card-grid">
          {classrooms.map(c => (
            <div key={c.id} className="card card-hover social-card">
              <div className="social-card-header">
                <div className="social-card-emoji">🏫</div>
                <div className="social-card-title">{c.name}</div>
                <span className={`social-role-badge social-role-badge--${c.role}`}>{c.role}</span>
              </div>
              {c.description && <div className="social-card-desc">{c.description}</div>}
              <div className="social-card-meta">
                <span>👥 {c.member_count} members</span>
                <span className="social-join-code" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}>{c.join_code}</span>
              </div>
              <div className="social-card-actions">
                <Link href={`/classrooms/${c.id}`} className="btn btn-primary btn-compact" style={{ flex: 1, textAlign: "center" }}>View Classroom →</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

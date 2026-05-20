"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { ImportDeckPanel } from "@/components/present/edit/import-deck-panel";

type PresentationRow = {
  id: string;
  title: string;
  status: "draft" | "live" | "finished";
  join_code: string | null;
  created_at: string;
  slide_count: number;
};

function statusBadge(status: string) {
  if (status === "live") return { label: "🔴 Live", color: "#e53e3e" };
  if (status === "finished") return { label: "✅ Finished", color: "#38a169" };
  return { label: "📝 Draft", color: "var(--muted)" };
}

export default function PresentPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importTitle, setImportTitle] = useState("");
  const [pendingImport, setPendingImport] = useState<Array<{ title: string; image_url: string }> | null>(null);
  const [importCreating, setImportCreating] = useState(false);
  const [importError, setImportError] = useState("");
  const [presentations, setPresentations] = useState<PresentationRow[]>([]);
  const [presLoading, setPresLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Load existing presentations
  useEffect(() => {
    if (!user) return;
    setPresLoading(true);
    supabase
      .from("presentations")
      .select("id, title, status, join_code, created_at, slides(count)")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          setPresentations(
            data.map((p) => ({
              ...p,
              slide_count: (p.slides as unknown as { count: number }[])?.[0]?.count ?? 0,
            }))
          );
        }
        setPresLoading(false);
      });
  }, [user]);

  const handleCreate = async () => {
    if (!user) {
      sessionStorage.setItem("qw_post_login_redirect", "/present");
      router.push("/login");
      return;
    }
    if (!title.trim()) { setCreateError("Give your presentation a title."); return; }
    setCreating(true);
    setCreateError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("create_presentation", {
        p_title: title.trim(),
        p_slides: [{
          slide_type: "content", title: "Welcome",
          content: { text: `# ${title.trim()}\n\nTap to start presenting` }, settings: {},
        }],
      });
      if (rpcError) throw rpcError;
      router.push(`/present/${data}/edit`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create presentation.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeckImported = (slides: Array<{ title: string; image_url: string }>) => {
    setShowImport(false);
    setPendingImport(slides);
  };

  const handleCreateFromImport = async () => {
    if (!pendingImport || !user) return;
    if (!importTitle.trim()) { setImportError("Give your presentation a title."); return; }
    setImportCreating(true);
    setImportError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("create_presentation", {
        p_title: importTitle.trim(),
        p_slides: pendingImport.map((s, i) => ({
          slide_type: "content", title: s.title,
          content: { image_url: s.image_url, text: "" }, settings: {}, order_index: i,
        })),
      });
      if (rpcError) throw rpcError;
      router.push(`/present/${data}/edit`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to create presentation.");
    } finally {
      setImportCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this presentation? This cannot be undone.")) return;
    setDeleteId(id);
    await supabase.from("presentations").delete().eq("id", id);
    setPresentations((prev) => prev.filter((p) => p.id !== id));
    setDeleteId(null);
  };

  if (authLoading) {
    return <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>Loading...</div>;
  }

  // Step 2: after import — title prompt
  if (pendingImport) {
    return (
      <div className="present-home-screen" style={{ minHeight: "calc(100vh - 72px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div className="card present-create-card" style={{ padding: "2rem", maxWidth: 480, width: "100%" }}>
          <div style={{ fontSize: "2rem", textAlign: "center", marginBottom: "0.75rem" }}>✅</div>
          <h2 style={{ fontWeight: 800, marginBottom: "0.25rem", textAlign: "center" }}>
            {pendingImport.length} slide{pendingImport.length !== 1 ? "s" : ""} ready
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", textAlign: "center", marginBottom: "1.25rem" }}>
            Give your presentation a title to finish.
          </p>
          <input
            value={importTitle}
            onChange={(e) => { setImportTitle(e.target.value); setImportError(""); }}
            placeholder="Presentation title…"
            autoFocus
            style={{ width: "100%", padding: "0.75rem 1rem", fontSize: "1rem", fontWeight: 600, border: "1.5px solid var(--line)", borderRadius: "var(--radius-xl)", background: "var(--surface)", color: "var(--ink)", outline: "none" }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreateFromImport(); }}
          />
          {importError && <p style={{ color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600, marginTop: "0.5rem" }}>{importError}</p>}
          <button onClick={handleCreateFromImport} disabled={importCreating || !importTitle.trim()} className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: "1rem" }}>
            {importCreating ? "Creating…" : "Create Presentation →"}
          </button>
          <button onClick={() => setPendingImport(null)} className="btn btn-secondary" style={{ width: "100%", marginTop: "0.5rem" }}>← Start over</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "calc(100vh - 72px)", padding: "2rem 1rem", maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 900, marginBottom: "0.25rem" }}>🎤 Presentations</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Create and manage your interactive presentations</p>
        </div>
        <Link href="/present/join" className="btn btn-secondary" style={{ fontSize: "0.875rem" }}>Join a presentation →</Link>
      </div>

      {/* Create row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem", marginBottom: "2rem", alignItems: "flex-start" }}>
        <div>
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setCreateError(""); }}
            placeholder="New presentation title…"
            style={{ width: "100%", padding: "0.75rem 1rem", fontSize: "1rem", fontWeight: 600, border: "1.5px solid var(--line)", borderRadius: "var(--radius-xl)", background: "var(--surface)", color: "var(--ink)", outline: "none" }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
          />
          {createError && <p style={{ color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600, marginTop: "0.25rem" }}>{createError}</p>}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={handleCreate} disabled={creating || !title.trim()} className="btn btn-primary">
            {creating ? "…" : "Create →"}
          </button>
          <button
            onClick={() => {
              if (!user) { sessionStorage.setItem("qw_post_login_redirect", "/present"); router.push("/login"); return; }
              setShowImport(true);
            }}
            className="btn btn-secondary"
            title="Import PDF, PPTX or PPT"
          >
            📥 Import
          </button>
        </div>
      </div>

      {/* Presentations list */}
      {!user ? (
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>Sign in to see and manage your presentations</p>
          <Link href="/login" className="btn btn-primary">Sign in</Link>
        </div>
      ) : presLoading ? (
        <div style={{ color: "var(--muted)", textAlign: "center", padding: "2rem" }}>Loading presentations…</div>
      ) : presentations.length === 0 ? (
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎤</div>
          <p style={{ fontWeight: 700, marginBottom: "0.25rem" }}>No presentations yet</p>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Create one above or import a deck to get started</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {presentations.map((p) => {
            const badge = statusBadge(p.status);
            return (
              <div key={p.id} className="card" style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.title || "Untitled"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                    <span style={{ color: badge.color, fontWeight: 600 }}>{badge.label}</span>
                    <span>{p.slide_count} slide{p.slide_count !== 1 ? "s" : ""}</span>
                    <span>{new Date(p.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>
                    {p.join_code && <span>Code: <strong>{p.join_code}</strong></span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                  <Link href={`/present/${p.id}/edit`} className="btn btn-secondary" style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }}>Edit</Link>
                  <Link href={`/present/${p.id}/edit`} className="btn btn-primary" style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }}>▶ Present</Link>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deleteId === p.id}
                    className="btn btn-secondary"
                    style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem", color: "var(--error, #e53e3e)" }}
                    title="Delete presentation"
                  >
                    {deleteId === p.id ? "…" : "✕"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Feature hints */}
      <div className="present-feature-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem", maxWidth: 680, margin: "2rem auto 0" }}>
        {[
          { icon: "☁️", title: "Word Cloud" }, { icon: "💬", title: "Open Text" },
          { icon: "📊", title: "Polls" }, { icon: "🏆", title: "Quizzes" },
          { icon: "📏", title: "Scales" }, { icon: "❓", title: "Q&A" },
        ].map((item) => (
          <div key={item.title} className="card" style={{ padding: "0.875rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>{item.icon}</div>
            <div style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{item.title}</div>
          </div>
        ))}
      </div>

      {showImport && (
        <ImportDeckPanel
          onImport={handleDeckImported}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}

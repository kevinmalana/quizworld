"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { ImportDeckPanel } from "@/components/present/edit/import-deck-panel";

export default function PresentPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importTitle, setImportTitle] = useState("");
  const [pendingImport, setPendingImport] = useState<Array<{ title: string; image_url: string }> | null>(null);
  const [importCreating, setImportCreating] = useState(false);
  const [importError, setImportError] = useState("");

  const handleCreate = async () => {
    if (!user) {
      sessionStorage.setItem("qw_post_login_redirect", "/present");
      router.push("/login");
      return;
    }

    if (!title.trim()) {
      setError("Give your presentation a title.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session?.access_token) {
        throw new Error("Sign in again.");
      }

      const { data, error: rpcError } = await supabase.rpc("create_presentation", {
        p_title: title.trim(),
        p_slides: [
          {
            slide_type: "content",
            title: "Welcome",
            content: { text: `# ${title.trim()}\n\nTap to start presenting` },
            settings: {},
          },
        ],
      });

      if (rpcError) throw rpcError;
      router.push(`/present/${data}/edit`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create presentation.";
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  // Called when ImportDeckPanel finishes — collect slides, ask for title, then create
  const handleDeckImported = (slides: Array<{ title: string; image_url: string }>) => {
    setShowImport(false);
    setPendingImport(slides);
    // Pre-fill title from first slide if available
    if (!importTitle) setImportTitle("");
  };

  const handleCreateFromImport = async () => {
    if (!pendingImport) return;
    if (!user) {
      sessionStorage.setItem("qw_post_login_redirect", "/present");
      router.push("/login");
      return;
    }
    if (!importTitle.trim()) {
      setImportError("Give your presentation a title.");
      return;
    }

    setImportCreating(true);
    setImportError("");

    try {
      const pSlides = pendingImport.map((s, i) => ({
        slide_type: "content",
        title: s.title,
        content: { image_url: s.image_url, text: "" },
        settings: {},
        order_index: i,
      }));

      const { data, error: rpcError } = await supabase.rpc("create_presentation", {
        p_title: importTitle.trim(),
        p_slides: pSlides,
      });

      if (rpcError) throw rpcError;
      router.push(`/present/${data}/edit`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create presentation.";
      setImportError(msg);
    } finally {
      setImportCreating(false);
    }
  };

  if (authLoading) {
    return <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>Loading...</div>;
  }

  // Step 2: after deck imported — title + confirm
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
            style={{
              width: "100%", padding: "0.75rem 1rem", fontSize: "1rem", fontWeight: 600,
              border: "1.5px solid var(--line)", borderRadius: "var(--radius-xl)",
              background: "var(--surface)", color: "var(--ink)", outline: "none",
            }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreateFromImport(); }}
          />
          {importError && (
            <p style={{ color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600, marginTop: "0.5rem" }}>{importError}</p>
          )}
          <button
            onClick={handleCreateFromImport}
            disabled={importCreating || !importTitle.trim()}
            className="btn btn-primary btn-lg"
            style={{ width: "100%", marginTop: "1rem" }}
          >
            {importCreating ? "Creating…" : "Create Presentation →"}
          </button>
          <button
            onClick={() => setPendingImport(null)}
            className="btn btn-secondary"
            style={{ width: "100%", marginTop: "0.5rem" }}
          >
            ← Start over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="present-home-screen" style={{ minHeight: "calc(100vh - 72px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div className="present-home-hero" style={{ textAlign: "center", marginBottom: "3rem" }}>
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🎤</div>
        <h1 className="font-display" style={{ fontSize: "2.5rem", fontWeight: 900, marginBottom: "0.75rem" }}>
          QuizWorld Present
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "1.125rem", maxWidth: 480 }}>
          Interactive presentations with live polls, word clouds, Q&A, and quizzes.
          Engage your audience in real-time.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", maxWidth: 680, width: "100%", marginBottom: "2rem" }}>
        {/* Start from scratch */}
        <div className="card present-create-card" style={{ padding: "2rem" }}>
          <h2 style={{ fontWeight: 800, marginBottom: "1rem" }}>Start from scratch</h2>
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(""); }}
            placeholder="Presentation title…"
            style={{
              width: "100%", padding: "0.75rem 1rem", fontSize: "1rem", fontWeight: 600,
              border: "1.5px solid var(--line)", borderRadius: "var(--radius-xl)",
              background: "var(--surface)", color: "var(--ink)", outline: "none",
            }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
            autoFocus
          />
          {error && (
            <p style={{ color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600, marginTop: "0.5rem" }}>{error}</p>
          )}
          <button
            onClick={handleCreate}
            disabled={creating || !title.trim()}
            className="btn btn-primary btn-lg"
            style={{ width: "100%", marginTop: "1rem" }}
          >
            {creating ? "Creating..." : "Create →"}
          </button>
          {!user && (
            <p style={{ textAlign: "center", fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.75rem" }}>
              Sign in to save and present
            </p>
          )}
        </div>

        {/* Import from deck */}
        <div className="card present-create-card" style={{ padding: "2rem", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", cursor: "pointer" }}
          onClick={() => {
            if (!user) {
              sessionStorage.setItem("qw_post_login_redirect", "/present");
              router.push("/login");
              return;
            }
            setShowImport(true);
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📥</div>
          <h2 style={{ fontWeight: 800, marginBottom: "0.5rem" }}>Import from deck</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
            Upload PDF, PPTX, or PPT — each page becomes a slide
          </p>
          <button className="btn btn-secondary" style={{ marginTop: "1rem", pointerEvents: "none" }}>
            Browse file →
          </button>
        </div>
      </div>

      <div className="present-feature-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", maxWidth: 680, width: "100%" }}>
        {[
          { icon: "☁️", title: "Word Cloud", desc: "Visualize collective thinking" },
          { icon: "💬", title: "Open Text", desc: "Collect written responses" },
          { icon: "📊", title: "Polls", desc: "Live voting and opinions" },
          { icon: "🏆", title: "Quizzes", desc: "Competitive questions" },
          { icon: "📏", title: "Scales", desc: "Rate confidence 1-10" },
          { icon: "❓", title: "Q&A", desc: "Audience asks, upvotes" },
        ].map((item) => (
          <div key={item.title} className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{item.icon}</div>
            <div style={{ fontWeight: 700, fontSize: "0.875rem" }}>{item.title}</div>
            <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{item.desc}</div>
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

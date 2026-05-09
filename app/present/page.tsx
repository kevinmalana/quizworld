"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";

export default function PresentPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

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

      // Create presentation with a welcome slide
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

  if (authLoading) {
    return <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>Loading...</div>;
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

      <div className="card present-create-card" style={{ padding: "2rem", maxWidth: 480, width: "100%", marginBottom: "2rem" }}>
        <h2 style={{ fontWeight: 800, marginBottom: "1rem" }}>Start a new presentation</h2>
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
          {creating ? "Creating..." : "Create Presentation →"}
        </button>

        {!user && (
          <p style={{ textAlign: "center", fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.75rem" }}>
            Sign in to save and present
          </p>
        )}
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
    </div>
  );
}

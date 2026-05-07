"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = (searchParams.get("code") || "").toUpperCase().slice(0, 6);
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-join if code is provided in URL
  useEffect(() => {
    if (initialCode.length === 6) {
      setCode(initialCode);
      // If name is already saved, auto-join directly
      const savedName = localStorage.getItem("qw_present_name");
      if (savedName) {
        void handleJoin();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoin = async () => {
    const joinCode = code.trim().toUpperCase();
    if (joinCode.length !== 6) {
      setError("Enter the 6-character code");
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("presentations")
      .select("id, status, title")
      .eq("join_code", joinCode)
      .single();

    if (fetchError || !data) {
      setError("Presentation not found. Check the code.");
      setLoading(false);
      return;
    }

    if (data.status === "draft") {
      setError("This presentation hasn't started yet.");
      setLoading(false);
      return;
    }

    router.push(`/present/${data.id}/live`);
  };

  return (
    <div style={{ minHeight: "calc(100vh - 72px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div className="card" style={{ padding: "2rem", maxWidth: 400, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎤</div>
        <h1 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>
          Join Presentation
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
          Enter the 6-character code from your presenter
        </p>

        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 6)); setError(""); }}
          placeholder="ABCDEF"
          maxLength={6}
          style={{
            width: "100%", padding: "0.75rem 1rem", fontSize: "1.5rem", fontWeight: 800,
            textAlign: "center", letterSpacing: "0.2em", textTransform: "uppercase",
            border: "2px solid var(--line)", borderRadius: "var(--radius-xl)",
            background: "var(--surface)", color: "var(--ink)", outline: "none",
            marginBottom: "1rem",
          }}
          onKeyDown={(e) => { if (e.key === "Enter") void handleJoin(); }}
          autoFocus
        />

        {error && (
          <p style={{ color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "1rem" }}>{error}</p>
        )}

        <button
          onClick={handleJoin}
          disabled={loading || code.trim().length !== 6}
          className="btn btn-primary btn-lg"
          style={{ width: "100%" }}
        >
          {loading ? "Joining..." : "Join →"}
        </button>
      </div>
    </div>
  );
}

export default function PresentJoinPage() {
  return (
    <Suspense fallback={<div style={{ padding: "4rem", textAlign: "center" }}>Loading...</div>}>
      <JoinForm />
    </Suspense>
  );
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/supabase-provider";

export function QuizToPresentationButton({ quizId }: { quizId: string }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");

  async function convert() {
    if (!user) {
      sessionStorage.setItem("qw_post_login_redirect", pathname);
      router.push("/login");
      return;
    }

    setConverting(true);
    setError("");
    try {
      const response = await fetch(`/api/quizzes/${encodeURIComponent(quizId)}/convert-presentation`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        presentationId?: string;
      };
      if (!response.ok || !payload.presentationId) {
        throw new Error(payload.error || "Could not convert this quiz.");
      }
      router.push(`/present/${payload.presentationId}/edit?source=quiz`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not convert this quiz.");
      setConverting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => void convert()}
        disabled={loading || converting}
      >
        {converting ? "Creating deck…" : "✨ Turn into presentation"}
      </button>
      {error ? <span role="alert" style={{ color: "var(--error, #c53030)", fontSize: "0.75rem", fontWeight: 700 }}>{error}</span> : null}
    </div>
  );
}

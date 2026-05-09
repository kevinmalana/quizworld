"use client";

import { useState } from "react";

type ShareStudyLinkButtonProps = {
  quizId: string;
  quizTitle: string;
  compact?: boolean;
};

export function ShareStudyLinkButton({ quizId, quizTitle, compact = false }: ShareStudyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/study/${quizId}`;

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleShare}
      title={`Share "${quizTitle}"`}
      style={{
        background: copied ? "var(--success-light)" : "var(--bg)",
        border: `1px solid ${copied ? "var(--success)" : "var(--line)"}`,
        borderRadius: "var(--radius-lg)",
        color: copied ? "var(--success)" : "var(--muted)",
        cursor: "pointer",
        padding: compact ? "0.5rem 0.75rem" : "0.6rem 0.75rem",
        fontSize: compact ? "0.8rem" : "0.875rem",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "✓ Copied" : "Share"}
    </button>
  );
}

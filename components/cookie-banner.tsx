"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("qw_cookie_consent")) {
        setVisible(true);
      }
    } catch {
      // localStorage blocked (private browsing etc) — skip banner
    }
  }, []);

  function accept() {
    try { localStorage.setItem("qw_cookie_consent", "1"); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      style={{
        position: "fixed",
        bottom: "1rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        width: "calc(100% - 2rem)",
        maxWidth: 560,
        background: "var(--surface, #1a1a1e)",
        border: "1px solid var(--line, #2a2a2e)",
        borderRadius: "var(--radius-xl, 1rem)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
        padding: "0.875rem 1.1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: "1.25rem", flexShrink: 0 }}>🍪</span>
      <p style={{ flex: 1, fontSize: "0.8125rem", color: "var(--muted, #888)", margin: 0, lineHeight: 1.5, minWidth: 180 }}>
        We use essential cookies to keep you signed in.{" "}
        <Link href="/privacy" style={{ color: "var(--accent, #7c3aed)", textDecoration: "none", fontWeight: 600 }}>
          Privacy Policy
        </Link>
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
        <button
          onClick={accept}
          style={{
            padding: "0.4rem 1rem",
            background: "var(--accent, #7c3aed)",
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            fontSize: "0.8125rem",
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Got it
        </button>
        <button
          onClick={accept}
          aria-label="Dismiss"
          style={{
            padding: "0.4rem 0.6rem",
            background: "transparent",
            color: "var(--muted, #888)",
            border: "1px solid var(--line, #2a2a2e)",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            background: "var(--bg, #0f0f12)",
            color: "var(--ink, #f0f0f3)",
            textAlign: "center",
            gap: "1rem",
          }}
        >
          <div style={{ fontSize: "3rem" }}>💥</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ color: "var(--muted, #888)", maxWidth: 400, lineHeight: 1.6 }}>
            An unexpected error occurred. It&apos;s been logged and we&apos;ll look into it.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                padding: "0.625rem 1.25rem",
                background: "#7c3aed",
                color: "#fff",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.9rem",
              }}
            >
              Try Again
            </button>
            <Link
              href="/"
              style={{
                padding: "0.625rem 1.25rem",
                background: "transparent",
                color: "var(--ink, #f0f0f3)",
                border: "1px solid var(--line, #2a2a2e)",
                borderRadius: "0.5rem",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "0.9rem",
              }}
            >
              Go Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}

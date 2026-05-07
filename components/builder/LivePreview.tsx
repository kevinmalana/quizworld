"use client";

import type { QuestionData } from "./QuestionCard";

interface Props {
  question: QuestionData;
  index: number;
  total: number;
  onClose: () => void;
}

const ANSWER_COLORS = [
  { bg: "#eff6ff", border: "#bfdbfe", solid: "#1d4ed8" },
  { bg: "#f5f3ff", border: "#ddd6fe", solid: "#6d28d9" },
  { bg: "#ecfeff", border: "#a5f3fc", solid: "#0f766e" },
  { bg: "#fff7ed", border: "#fdba74", solid: "#c2410c" },
];

export function LivePreview({ question, index, total, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-dark" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          margin: "0 1rem",
          borderRadius: 28,
          overflow: "hidden",
          background: "linear-gradient(180deg, #0f172a 0%, #0f172a 35%, #f8f9fc 35.01%, #f8f9fc 100%)",
        }}
      >
        {/* Top bar */}
        <div style={{ padding: "1.25rem 1.5rem 0.75rem", color: "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#93c5fd" }}>
              PREVIEW · Question {index + 1} of {total}
            </span>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: "50%", border: "none",
                background: "rgba(255,255,255,0.1)", color: "white", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem",
              }}
            >
              ✕
            </button>
          </div>
          {question.imageUrl && (
            <img src={question.imageUrl} alt="" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 16, marginBottom: "0.75rem" }} />
          )}
          <div style={{ fontSize: "clamp(1.25rem, 3vw, 1.75rem)", fontWeight: 900, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
            {question.text || "Your question will appear here"}
          </div>
        </div>

        {/* Answer grid */}
        <div style={{ padding: "1rem 1.5rem 1.5rem", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.625rem" }}>
          {question.answers.map((answer, idx) => {
            const c = ANSWER_COLORS[idx] || ANSWER_COLORS[0];
            return (
              <div
                key={answer.id}
                style={{
                  padding: "0.875rem",
                  borderRadius: 18,
                  border: `2px solid ${c.border}`,
                  background: c.bg,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  minHeight: 56,
                }}
              >
                <div
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: c.solid, color: "white",
                    display: "grid", placeItems: "center",
                    fontWeight: 900, fontSize: "0.85rem", flexShrink: 0,
                  }}
                >
                  {String.fromCharCode(65 + idx)}
                </div>
                {answer.imageUrl && (
                  <img src={answer.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                )}
                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a" }}>
                  {answer.text || "..."}
                </span>
              </div>
            );
          })}
        </div>

        {/* Timer bar */}
        <div style={{ padding: "0 1.5rem 1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>⏱ {question.timeLimit}s</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>⭐ {question.points}pts</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: "100%", background: "var(--accent)", borderRadius: 3 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback } from "react";
import type { QuestionData } from "./QuestionCard";

interface Props {
  questions: QuestionData[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAdd: () => void;
}

function getStatus(q: QuestionData): "ready" | "error" | "empty" {
  if (!q.text.trim()) return "empty";
  const filled = q.answers.filter((a) => a.text.trim()).length;
  const correct = q.answers.filter((a) => a.isCorrect).length;
  if (filled < q.answers.length || (q.type !== "poll" && correct !== 1)) return "error";
  return "ready";
}

export function QuestionSidebar({ questions, activeIndex, onSelect, onReorder, onAdd }: Props) {
  const readyCount = questions.filter((q) => getStatus(q) === "ready").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="tag tag-accent" style={{ fontSize: "0.65rem" }}>{questions.length} Questions</span>
        <span className="tag tag-success" style={{ fontSize: "0.65rem" }}>{readyCount} ready</span>
      </div>

      {/* Progress */}
      <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid var(--line)" }}>
        <div style={{ height: 4, borderRadius: 2, background: "var(--line)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${questions.length > 0 ? (readyCount / questions.length) * 100 : 0}%`, background: "var(--success)", borderRadius: 2, transition: "width 0.3s" }} />
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0.25rem 0.5rem" }}>
        {questions.map((q, idx) => {
          const status = getStatus(q);
          const isActive = idx === activeIndex;
          const preview = q.text.slice(0, 40) + (q.text.length > 40 ? "…" : "");
          return (
            <div key={q.id} draggable
              onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; (e.currentTarget as HTMLElement).style.opacity = "0.4"; }}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              onClick={() => onSelect(idx)}
              style={{
                display: "flex", alignItems: "center", gap: "0.625rem",
                padding: "0.625rem 0.75rem", marginBottom: "0.125rem",
                borderRadius: "var(--radius-sm)", cursor: "pointer",
                background: isActive ? "var(--accent-light)" : "transparent",
                border: isActive ? "1px solid var(--accent)" : "1px solid transparent",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg-subtle)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              {/* Number */}
              <div style={{
                width: "1.75rem", height: "1.75rem", borderRadius: "var(--radius-sm)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: "0.7rem", flexShrink: 0,
                background: isActive ? "var(--accent)" : status === "ready" ? "var(--success)" : status === "error" ? "var(--primary)" : "var(--bg-subtle)",
                color: isActive || status !== "empty" ? "#fff" : "var(--muted)",
              }}>
                {idx + 1}
              </div>
              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 600, color: isActive ? "var(--accent)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {q.text || "Empty"}
                </p>
                <p style={{ fontSize: "0.625rem", color: "var(--faint)", marginTop: "0.125rem" }}>
                  {q.type === "true_false" ? "T/F" : q.type === "poll" ? "Poll" : `${q.answers.length} answers`} · {q.timeLimit}s · {q.points}pts
                </p>
              </div>
              {/* Status dot */}
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: status === "ready" ? "var(--success)" : status === "error" ? "var(--primary)" : "var(--line)", flexShrink: 0 }} />
            </div>
          );
        })}
      </div>

      {/* Add */}
      <div style={{ padding: "0.5rem", borderTop: "1px solid var(--line)" }}>
        <button onClick={onAdd} className="btn btn-sm btn-secondary" style={{ width: "100%", borderStyle: "dashed", fontSize: "0.75rem" }}>+ Add Question</button>
      </div>
    </div>
  );
}

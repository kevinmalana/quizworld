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

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).style.opacity = "0.4";
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent, idx: number, dropIdx: number | null) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    if (dropIdx !== null && idx !== dropIdx) onReorder(idx, dropIdx);
  }, [onReorder]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="tag tag-accent" style={{ fontSize: "0.65rem" }}>Questions {questions.length}</span>
        <span className="tag tag-success" style={{ fontSize: "0.65rem" }}>{readyCount} ready</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0.375rem" }}>
        {questions.map((q, idx) => {
          const status = getStatus(q);
          const isActive = idx === activeIndex;
          return (
            <div key={q.id} draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={(e) => handleDragEnd(e, idx, null)}
              onClick={() => onSelect(idx)}
              className={isActive ? "card" : ""}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.5rem 0.625rem", marginBottom: "0.125rem",
                borderRadius: "var(--radius-sm)", cursor: "pointer",
                background: isActive ? "var(--accent-light)" : "transparent",
                border: isActive ? "1px solid var(--accent)" : "1px solid transparent",
                transition: "all 0.15s",
              }}>
              <div className="tag" style={{
                padding: "0.125rem 0.375rem", fontSize: "0.6rem", minWidth: "1.25rem", justifyContent: "center",
                background: isActive ? "var(--accent)" : status === "ready" ? "var(--success)" : status === "error" ? "var(--primary)" : "var(--bg-subtle)",
                color: isActive || status !== "empty" ? "#fff" : "var(--muted)",
              }}>
                {idx + 1}
              </div>
              <p style={{ flex: 1, fontSize: "0.7rem", fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {q.text || "Empty"}
              </p>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: status === "ready" ? "var(--success)" : status === "error" ? "var(--primary)" : "var(--line)", flexShrink: 0 }} />
            </div>
          );
        })}
      </div>

      <div style={{ padding: "0.375rem", borderTop: "1px solid var(--line)" }}>
        <button onClick={onAdd} className="btn btn-sm btn-secondary" style={{ width: "100%", borderStyle: "dashed" }}>+ Add Question</button>
      </div>
    </div>
  );
}

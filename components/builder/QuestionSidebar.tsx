"use client";

import { useState } from "react";
import type { QuestionData } from "./QuestionCard";

interface Props {
  questions: QuestionData[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAdd: () => void;
  onDelete?: (index: number) => void;
  onDuplicate?: (index: number) => void;
}

function getStatus(q: QuestionData): "ready" | "error" | "empty" {
  if (!q.text.trim()) return "empty";
  const filled = q.answers.filter((a) => a.text.trim()).length;
  const correct = q.answers.filter((a) => a.isCorrect && a.text.trim()).length;
  if (filled < 2 || (q.type !== "poll" && correct !== 1)) return "error";
  return "ready";
}

export function QuestionSidebar({ questions, activeIndex, onSelect, onReorder, onAdd, onDelete, onDuplicate }: Props) {
  const readyCount = questions.filter((q) => getStatus(q) === "ready").length;
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function handleDragStart(e: React.DragEvent, idx: number) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
    setDragIdx(idx);
    (e.currentTarget as HTMLElement).style.opacity = "0.4";
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIdx(idx);
  }

  function handleDrop(e: React.DragEvent, toIdx: number) {
    e.preventDefault();
    const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(fromIdx) && fromIdx !== toIdx) {
      onReorder(fromIdx, toIdx);
    }
    setDragIdx(null);
    setDropIdx(null);
  }

  function handleDragEnd(e: React.DragEvent) {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    setDragIdx(null);
    setDropIdx(null);
  }

  function toggleSelect(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === questions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(questions.map((_, i) => i)));
    }
  }

  function deleteSelected() {
    if (!onDelete) return;
    const sorted = [...selected].sort((a, b) => b - a);
    sorted.forEach((idx) => onDelete(idx));
    setSelected(new Set());
  }

  function duplicateSelected() {
    if (!onDuplicate) return;
    const sorted = [...selected].sort((a, b) => a - b);
    sorted.forEach((idx) => onDuplicate(idx));
    setSelected(new Set());
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "0.625rem 0.875rem", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="tag tag-accent" style={{ fontSize: "0.65rem" }}>{questions.length} Questions</span>
        <span className="tag tag-success" style={{ fontSize: "0.65rem" }}>{readyCount} ready</span>
      </div>

      {/* Progress bar */}
      <div style={{ padding: "0.375rem 0.875rem", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--muted)" }}>{readyCount}/{questions.length} complete</span>
          {questions.length > 0 && (
            <span style={{ fontSize: "0.6rem", fontWeight: 700, color: readyCount === questions.length ? "var(--success)" : "var(--muted)" }}>
              {Math.round((readyCount / questions.length) * 100)}%
            </span>
          )}
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${questions.length > 0 ? (readyCount / questions.length) * 100 : 0}%`,
            background: readyCount === questions.length ? "var(--success)" : "var(--accent)",
            borderRadius: 3,
            transition: "width 0.3s, background 0.3s",
          }} />
        </div>
      </div>

      {/* Bulk operations bar */}
      {selected.size > 0 && (
        <div style={{ padding: "0.375rem 0.875rem", borderBottom: "1px solid var(--line)", display: "flex", gap: "0.25rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--accent)", marginRight: "0.25rem" }}>{selected.size} selected</span>
          {onDelete && (
            <button onClick={deleteSelected} className="btn btn-sm btn-ghost" style={{ padding: "0.25rem 0.5rem", fontSize: "0.65rem", color: "var(--primary)" }}>🗑 Delete</button>
          )}
          {onDuplicate && (
            <button onClick={duplicateSelected} className="btn btn-sm btn-ghost" style={{ padding: "0.25rem 0.5rem", fontSize: "0.65rem" }}>⧉ Copy</button>
          )}
          <button onClick={() => setSelected(new Set())} className="btn btn-sm btn-ghost" style={{ padding: "0.25rem 0.5rem", fontSize: "0.65rem" }}>✕</button>
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0.125rem 0.375rem" }}>
        {questions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📝</div>
            <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.25rem" }}>No questions yet</p>
            <p style={{ fontSize: "0.6875rem", color: "var(--muted)", lineHeight: 1.5 }}>Click &quot;+ Add Question&quot; below to start building your quiz.</p>
          </div>
        ) : (
          questions.map((q, idx) => {
            const status = getStatus(q);
            const isActive = idx === activeIndex;
            const isDragging = idx === dragIdx;
            const isDropTarget = idx === dropIdx && dragIdx !== null && dragIdx !== idx;
            const isSelected = selected.has(idx);

            return (
              <div
                key={q.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                onClick={() => onSelect(idx)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.5rem 0.625rem", marginBottom: "0.0625rem",
                  borderRadius: "var(--radius-sm)", cursor: "pointer",
                  background: isActive ? "var(--accent-light)" : isSelected ? "var(--bg-subtle)" : "transparent",
                  border: isDropTarget ? "2px solid var(--accent)" : isActive ? "1px solid var(--accent)" : "1px solid transparent",
                  opacity: isDragging ? 0.4 : 1,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg-subtle)"; }}
                onMouseLeave={(e) => { if (!isActive && !isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => { e.stopPropagation(); toggleSelect(idx); }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 14, height: 14, accentColor: "var(--accent)", cursor: "pointer", flexShrink: 0 }}
                />
                <div style={{
                  width: "1.75rem", height: "1.75rem", borderRadius: "var(--radius-sm)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: "0.7rem", flexShrink: 0,
                  background: isActive ? "var(--accent)" : status === "ready" ? "var(--success)" : status === "error" ? "var(--primary)" : "var(--bg-subtle)",
                  color: isActive || status !== "empty" ? "#fff" : "var(--muted)",
                }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "0.75rem", fontWeight: 600, color: isActive ? "var(--accent)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {q.text || "Empty"}
                  </p>
                  <p style={{ fontSize: "0.625rem", color: "var(--faint)", marginTop: "0.125rem" }}>
                    {q.type === "true_false" ? "T/F" : q.type === "poll" ? "Poll" : `${q.answers.length} answers`} · {q.timeLimit}s · {q.points}pts
                  </p>
                </div>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: status === "ready" ? "var(--success)" : status === "error" ? "var(--primary)" : "var(--line)", flexShrink: 0 }} />
              </div>
            );
          })
        )}
      </div>

      {/* Add */}
      <div style={{ padding: "0.375rem", borderTop: "1px solid var(--line)", display: "flex", gap: "0.25rem" }}>
        <button onClick={onAdd} className="btn btn-sm btn-secondary" style={{ flex: 1, borderStyle: "dashed", fontSize: "0.75rem" }}>+ Add Question</button>
        <button onClick={selectAll} className="btn btn-sm btn-ghost" style={{ padding: "0.375rem 0.5rem", fontSize: "0.65rem" }} title="Select all">☑</button>
      </div>
    </div>
  );
}

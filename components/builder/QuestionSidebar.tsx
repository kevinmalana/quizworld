"use client";

import { useState, useRef, useCallback } from "react";
import type { QuestionData } from "./QuestionCard";

interface Props {
  questions: QuestionData[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAdd: () => void;
}

function getQuestionStatus(q: QuestionData): "ready" | "error" | "empty" {
  if (!q.text.trim()) return "empty";
  const filled = q.answers.filter((a) => a.text.trim()).length;
  const correct = q.answers.filter((a) => a.isCorrect).length;
  if (filled < q.answers.length || (q.type !== "poll" && correct !== 1)) return "error";
  return "ready";
}

export function QuestionSidebar({ questions, activeIndex, onSelect, onReorder, onAdd }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).style.opacity = "0.4";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDropIndex(idx);
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      onReorder(dragIndex, dropIndex);
    }
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, dropIndex, onReorder]);

  const readyCount = questions.filter((q) => getQuestionStatus(q) === "ready").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "var(--line)" }}>
        <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">Questions</span>
        <span className="text-[11px] font-semibold" style={{ color: "var(--success)" }}>
          {readyCount}/{questions.length}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5" onDragOver={(e) => e.preventDefault()}>
        {questions.map((q, idx) => {
          const status = getQuestionStatus(q);
          const isActive = idx === activeIndex;
          const isDropTarget = idx === dropIndex && dragIndex !== null && dragIndex !== idx;

          return (
            <div
              key={q.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelect(idx)}
              className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all duration-100 select-none group"
              style={{
                background: isActive ? "var(--accent-light)" : "transparent",
                border: isActive ? "1px solid var(--accent)" : isDropTarget ? "1px dashed var(--accent)" : "1px solid transparent",
              }}
            >
              {/* Drag handle */}
              <div className="flex-shrink-0 w-3 flex flex-col items-center gap-px opacity-0 group-hover:opacity-40 transition-opacity cursor-grab">
                <div className="w-2 h-0.5 rounded-full bg-[var(--muted)]" />
                <div className="w-2 h-0.5 rounded-full bg-[var(--muted)]" />
                <div className="w-2 h-0.5 rounded-full bg-[var(--muted)]" />
              </div>

              {/* Number */}
              <div
                className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center font-display font-black text-[10px] transition-colors"
                style={{
                  background: isActive ? "var(--accent)" : status === "ready" ? "var(--success)" : status === "error" ? "var(--primary)" : "var(--bg)",
                  color: isActive || status !== "empty" ? "#fff" : "var(--muted)",
                }}
              >
                {idx + 1}
              </div>

              {/* Text */}
              <p className="flex-1 text-[11px] font-semibold text-[var(--ink)] truncate leading-tight">
                {q.text || "Empty"}
              </p>

              {/* Dot */}
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: status === "ready" ? "var(--success)" : status === "error" ? "var(--primary)" : "var(--line)" }}
              />
            </div>
          );
        })}
      </div>

      {/* Add */}
      <div className="p-1.5 border-t" style={{ borderColor: "var(--line)" }}>
        <button
          onClick={onAdd}
          className="w-full py-2 rounded-lg text-xs font-bold text-[var(--accent)] transition-all flex items-center justify-center gap-1"
          style={{ border: "1px dashed var(--accent)", background: "var(--accent-light)" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
          Add
        </button>
      </div>
    </div>
  );
}

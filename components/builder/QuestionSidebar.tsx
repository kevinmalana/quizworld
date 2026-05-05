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
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
    // Ghost element
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = "0.5";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIndex(idx);
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = "1";
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      onReorder(dragIndex, dropIndex);
    }
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, dropIndex, onReorder]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Questions</span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: "var(--bg)", color: "var(--muted)" }}
          >
            {questions.length}
          </span>
        </div>
        {/* Quiz stats */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: "var(--success)" }}>
            {questions.filter((q) => getQuestionStatus(q) === "ready").length} ready
          </span>
        </div>
      </div>

      {/* Question list */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-2 space-y-1"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {questions.map((q, idx) => {
          const status = getQuestionStatus(q);
          const isActive = idx === activeIndex;
          const isDragging = idx === dragIndex;
          const isDropTarget = idx === dropIndex && dragIndex !== null && dragIndex !== idx;

          return (
            <div
              key={q.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelect(idx)}
              className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 select-none group"
              style={{
                background: isActive ? "var(--accent-light)" : isDragging ? "var(--bg)" : "transparent",
                border: isActive ? "1.5px solid var(--accent)" : isDropTarget ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                opacity: isDragging ? 0.5 : 1,
              }}
            >
              {/* Drag handle */}
              <div className="flex-shrink-0 w-4 h-4 flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                <div className="w-3 h-0.5 rounded-full" style={{ background: "var(--muted)" }} />
                <div className="w-3 h-0.5 rounded-full" style={{ background: "var(--muted)" }} />
                <div className="w-3 h-0.5 rounded-full" style={{ background: "var(--muted)" }} />
              </div>

              {/* Number */}
              <div
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-display font-black text-xs transition-colors"
                style={{
                  background: isActive ? "var(--accent)" : status === "ready" ? "var(--success)" : status === "error" ? "var(--primary)" : "var(--bg)",
                  color: isActive || status !== "empty" ? "#fff" : "var(--muted)",
                  border: status === "empty" && !isActive ? "1px solid var(--line)" : "none",
                }}
              >
                {idx + 1}
              </div>

              {/* Preview text */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--ink)] truncate leading-snug">
                  {q.text || "Empty question"}
                </p>
                <p className="text-[10px] text-[var(--muted)] mt-0.5 truncate">
                  {q.type === "true_false" ? "True/False" : q.type === "poll" ? "Poll" : `${q.answers.length} answers`}
                  {q.text.trim() && q.answers.filter(a => a.text.trim()).length === q.answers.length && q.answers.filter(a => a.isCorrect).length === 1 ? "" : " · incomplete"}
                </p>
              </div>

              {/* Status dot */}
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background: status === "ready" ? "var(--success)" : status === "error" ? "var(--primary)" : "var(--line)",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Add question */}
      <div className="p-2 border-t" style={{ borderColor: "var(--line)" }}>
        <button
          onClick={onAdd}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-[var(--accent)] hover:bg-[var(--accent-light)] transition-all flex items-center justify-center gap-1.5"
          style={{ border: "1.5px dashed var(--accent)", background: "transparent" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Question
        </button>
      </div>
    </div>
  );
}

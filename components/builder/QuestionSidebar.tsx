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

const STATUS_COLORS = {
  ready: { bg: "#10b981", glow: "rgba(16,185,129,0.3)" },
  error: { bg: "#ef4444", glow: "rgba(239,68,68,0.3)" },
  empty: { bg: "rgba(255,255,255,0.15)", glow: "none" },
};

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
    e.dataTransfer.dropEffect = "move";
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
      <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.3)" }}>Questions</span>
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
            {questions.length}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${questions.length > 0 ? (readyCount / questions.length) * 100 : 0}%`,
              background: "linear-gradient(90deg, #10b981, #059669)",
              boxShadow: "0 0 12px rgba(16,185,129,0.4)",
            }}
          />
        </div>
        <p className="text-[10px] font-semibold mt-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
          {readyCount} of {questions.length} ready
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1" onDragOver={(e) => e.preventDefault()}>
        {questions.map((q, idx) => {
          const status = getQuestionStatus(q);
          const isActive = idx === activeIndex;
          const isDropTarget = idx === dropIndex && dragIndex !== null && dragIndex !== idx;
          const statusStyle = STATUS_COLORS[status];

          return (
            <div
              key={q.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelect(idx)}
              className="relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 select-none group"
              style={{
                background: isActive ? "rgba(99,102,241,0.12)" : isDropTarget ? "rgba(99,102,241,0.08)" : "transparent",
                border: isActive ? "1px solid rgba(99,102,241,0.3)" : isDropTarget ? "1px dashed rgba(99,102,241,0.3)" : "1px solid transparent",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              {/* Drag handle */}
              <div className="flex-shrink-0 w-3.5 flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing">
                <div className="w-2.5 h-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.5)" }} />
                <div className="w-2.5 h-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.5)" }} />
                <div className="w-2.5 h-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.5)" }} />
              </div>

              {/* Number */}
              <div
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs transition-all duration-200"
                style={{
                  background: isActive ? "linear-gradient(135deg, #6366f1, #4f46e5)" : status === "ready" ? "rgba(16,185,129,0.15)" : status === "error" ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.06)",
                  color: isActive ? "#fff" : status === "ready" ? "#10b981" : status === "error" ? "#f87171" : "rgba(255,255,255,0.3)",
                  boxShadow: isActive ? "0 2px 8px rgba(99,102,241,0.3)" : "none",
                }}
              >
                {idx + 1}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate leading-snug" style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.6)" }}>
                  {q.text || "Empty question"}
                </p>
                <p className="text-[10px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {q.type === "true_false" ? "True/False" : q.type === "poll" ? "Poll" : `${q.answers.length} answers`}
                </p>
              </div>

              {/* Status */}
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: statusStyle.bg, boxShadow: `0 0 8px ${statusStyle.glow}` }}
              />
            </div>
          );
        })}
      </div>

      {/* Add */}
      <div className="p-2.5 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <button
          onClick={onAdd}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2"
          style={{
            border: "1.5px dashed rgba(99,102,241,0.3)",
            color: "#818cf8",
            background: "rgba(99,102,241,0.04)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(99,102,241,0.1)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(99,102,241,0.04)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)"; }}
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

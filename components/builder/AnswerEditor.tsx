"use client";

import { useState, useRef } from "react";

const ANSWER_COLORS = ["#e11d48", "#2563eb", "#d97706", "#059669"];
const ANSWER_LABELS = ["A", "B", "C", "D"];
const ANSWER_ICONS = ["▲", "◆", "●", "■"];

export interface AnswerData {
  id: string;
  text: string;
  isCorrect: boolean;
  imageUrl?: string;
}

interface Props {
  answer: AnswerData;
  index: number;
  onChange: (text: string) => void;
  onCorrect: () => void;
  onRemove?: () => void;
  canRemove: boolean;
}

export function AnswerEditor({ answer, index, onChange, onCorrect, onRemove, canRemove }: Props) {
  const color = ANSWER_COLORS[index] || "#64748b";
  const label = ANSWER_LABELS[index] || String(index + 1);
  const [focused, setFocused] = useState(false);

  return (
    <div
      className="group relative rounded-2xl transition-all duration-200"
      onClick={onCorrect}
      style={{
        background: answer.isCorrect ? color + "0a" : "var(--surface)",
        border: `1.5px solid ${answer.isCorrect ? color + "60" : focused ? color + "40" : "var(--line)"}`,
        boxShadow: focused ? `0 0 0 3px ${color}15` : "none",
        cursor: "pointer",
      }}
    >
      <div className="flex items-center gap-3 p-3.5">
        {/* Correct toggle */}
        <div
          title={answer.isCorrect ? "Correct answer" : "Click to mark correct"}
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm transition-all duration-200"
          style={{
            background: answer.isCorrect ? color : color + "15",
            color: answer.isCorrect ? "#fff" : color,
            boxShadow: answer.isCorrect ? `0 2px 8px ${color}40` : "none",
          }}
        >
          {answer.isCorrect ? "✓" : label}
        </div>

        {/* Text input */}
        <input
          type="text"
          value={answer.text}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={`Answer ${label}${answer.isCorrect ? " (correct)" : ""}`}
          className="flex-1 bg-transparent font-semibold text-[var(--ink)] outline-none text-sm placeholder:text-[var(--muted)]/50"
        />

        {/* Remove button */}
        {canRemove && onRemove && (
          <button
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-red-500 hover:bg-red-50 transition-all"
            title="Remove answer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

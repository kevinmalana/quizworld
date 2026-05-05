"use client";

import { useState } from "react";

export type QuestionType = "multiple_choice" | "true_false" | "poll";

export interface AnswerData {
  id: string;
  text: string;
  isCorrect: boolean;
  imageUrl?: string;
}

export interface QuestionData {
  id: string;
  text: string;
  type: QuestionType;
  answers: AnswerData[];
  timeLimit: number;
  points: number;
  explanation?: string;
  imageUrl?: string;
}

interface Props {
  question: QuestionData;
  index: number;
  total: number;
  onChange: (q: QuestionData) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const TIME_OPTIONS = [10, 20, 30, 60];
const POINT_OPTIONS = [500, 1000, 2000];
const ANSWER_GRADIENTS = [
  ["#ef4444", "#dc2626"],
  ["#3b82f6", "#2563eb"],
  ["#f59e0b", "#d97706"],
  ["#10b981", "#059669"],
  ["#8b5cf6", "#7c3aed"],
  ["#ec4899", "#db2777"],
];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getIssues(q: QuestionData): { message: string; severity: "error" | "warning" }[] {
  const issues: { message: string; severity: "error" | "warning" }[] = [];
  if (!q.text.trim()) issues.push({ message: "Question text is missing", severity: "error" });
  const filled = q.answers.filter((a) => a.text.trim()).length;
  if (filled < q.answers.length) issues.push({ message: "Some answers are blank", severity: "error" });
  if (q.type !== "poll") {
    const correct = q.answers.filter((a) => a.isCorrect).length;
    if (correct !== 1) issues.push({ message: "Mark exactly one correct answer", severity: "error" });
  }
  const texts = q.answers.map((a) => a.text.trim().toLowerCase()).filter(Boolean);
  if (new Set(texts).size < texts.length) issues.push({ message: "Duplicate answers detected", severity: "warning" });
  return issues;
}

export function QuestionCard({ question, index, total, onChange, onDelete, onDuplicate }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [focusedAnswer, setFocusedAnswer] = useState<number | null>(null);
  const issues = getIssues(question);
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const isReady = errorCount === 0;

  const updateAnswer = (i: number, text: string) => {
    onChange({ ...question, answers: question.answers.map((a, ai) => (ai === i ? { ...a, text } : a)) });
  };

  const setCorrect = (i: number) => {
    if (question.type === "poll") return;
    onChange({ ...question, answers: question.answers.map((a, ai) => ({ ...a, isCorrect: ai === i })) });
  };

  const addAnswer = () => {
    if (question.answers.length >= 6) return;
    onChange({ ...question, answers: [...question.answers, { id: uid(), text: "", isCorrect: false }] });
  };

  const removeAnswer = (i: number) => {
    if (question.answers.length <= 2) return;
    const newAnswers = question.answers.filter((_, ai) => ai !== i);
    if (question.answers[i].isCorrect && newAnswers.length > 0) newAnswers[0].isCorrect = true;
    onChange({ ...question, answers: newAnswers });
  };

  const setType = (type: QuestionType) => {
    if (type === "true_false") {
      onChange({
        ...question,
        type,
        answers: [
          { id: uid(), text: "True", isCorrect: true },
          { id: uid(), text: "False", isCorrect: false },
        ],
      });
    } else if (type === "poll") {
      onChange({
        ...question,
        type,
        answers: question.answers.map((a) => ({ ...a, isCorrect: false })),
      });
    } else {
      onChange({ ...question, type });
    }
  };

  return (
    <div className="flex flex-col gap-0">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          {/* Number badge */}
          <div
            className="relative w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm text-white"
            style={{
              background: isReady
                ? "linear-gradient(135deg, #10b981, #059669)"
                : errorCount > 0
                ? "linear-gradient(135deg, #ef4444, #dc2626)"
                : "linear-gradient(135deg, #6366f1, #4f46e5)",
              boxShadow: isReady
                ? "0 4px 14px rgba(16,185,129,0.35)"
                : errorCount > 0
                ? "0 4px 14px rgba(239,68,68,0.3)"
                : "0 4px 14px rgba(99,102,241,0.3)",
            }}
          >
            {index + 1}
          </div>

          {/* Status */}
          <span
            className="px-3 py-1 rounded-full text-xs font-bold tracking-wide"
            style={{
              background: isReady ? "rgba(16,185,129,0.12)" : errorCount > 0 ? "rgba(239,68,68,0.1)" : "rgba(99,102,241,0.1)",
              color: isReady ? "#10b981" : errorCount > 0 ? "#ef4444" : "#6366f1",
            }}
          >
            {isReady ? "✓ Ready" : `${issues.length} issue${issues.length === 1 ? "" : "s"}`}
          </span>

          {/* Type pills */}
          <div className="flex items-center gap-1 ml-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
            {([
              { key: "multiple_choice" as const, label: "Multiple Choice", icon: "◉" },
              { key: "true_false" as const, label: "True / False", icon: "⚖" },
              { key: "poll" as const, label: "Poll", icon: "📊" },
            ]).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setType(key)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200"
                style={{
                  background: question.type === key ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "transparent",
                  color: question.type === key ? "#fff" : "rgba(255,255,255,0.4)",
                  boxShadow: question.type === key ? "0 2px 8px rgba(99,102,241,0.3)" : "none",
                }}
                title={label}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
            style={{
              background: showSettings ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
              color: showSettings ? "#818cf8" : "rgba(255,255,255,0.4)",
            }}
            title="Question settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" /><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83" />
            </svg>
          </button>
          <button
            onClick={onDuplicate}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[rgba(255,255,255,0.4)] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-all"
            title="Duplicate"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[rgba(255,255,255,0.4)] hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Delete"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Issues ── */}
      {issues.length > 0 && (
        <div className="rounded-2xl p-3.5 mb-4 space-y-1.5" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
          {issues.map((issue) => (
            <p key={issue.message} className="text-xs font-semibold flex items-center gap-2"
              style={{ color: issue.severity === "error" ? "#f87171" : "#fbbf24" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: issue.severity === "error" ? "#ef4444" : "#f59e0b" }} />
              {issue.message}
            </p>
          ))}
        </div>
      )}

      {/* ── Settings ── */}
      {showSettings && (
        <div className="rounded-2xl p-4 mb-4 flex flex-wrap gap-5 items-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-[rgba(255,255,255,0.35)] uppercase tracking-widest">⏱ Time</span>
            <div className="flex gap-1.5">
              {TIME_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => onChange({ ...question, timeLimit: t })}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200"
                  style={{
                    background: question.timeLimit === t ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "rgba(255,255,255,0.05)",
                    color: question.timeLimit === t ? "#fff" : "rgba(255,255,255,0.5)",
                    boxShadow: question.timeLimit === t ? "0 2px 10px rgba(99,102,241,0.3)" : "none",
                  }}
                >
                  {t}s
                </button>
              ))}
            </div>
          </div>
          <div className="w-px h-6" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-[rgba(255,255,255,0.35)] uppercase tracking-widest">⭐ Points</span>
            <div className="flex gap-1.5">
              {POINT_OPTIONS.map((pt) => (
                <button
                  key={pt}
                  onClick={() => onChange({ ...question, points: pt })}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200"
                  style={{
                    background: question.points === pt ? "linear-gradient(135deg, #f59e0b, #d97706)" : "rgba(255,255,255,0.05)",
                    color: question.points === pt ? "#fff" : "rgba(255,255,255,0.5)",
                    boxShadow: question.points === pt ? "0 2px 10px rgba(245,158,11,0.3)" : "none",
                  }}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Question text ── */}
      <div className="relative mb-5">
        <div className="absolute -top-2.5 left-4 px-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)", background: "#1a1a2e" }}>
          Question
        </div>
        <textarea
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          placeholder="Type your question here…"
          rows={2}
          className="w-full font-bold text-lg text-white rounded-2xl p-5 outline-none resize-none transition-all duration-200 placeholder:text-[rgba(255,255,255,0.15)]"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1.5px solid rgba(255,255,255,0.08)",
            lineHeight: 1.6,
          }}
          onFocus={(e) => { e.target.style.borderColor = "rgba(99,102,241,0.5)"; e.target.style.background = "rgba(99,102,241,0.04)"; e.target.style.boxShadow = "0 0 0 4px rgba(99,102,241,0.08)"; }}
          onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.background = "rgba(255,255,255,0.04)"; e.target.style.boxShadow = "none"; }}
        />
      </div>

      {/* ── Answers ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {question.answers.map((answer, idx) => {
          const [gradStart, gradEnd] = ANSWER_GRADIENTS[idx] || ANSWER_GRADIENTS[0];
          const isFocused = focusedAnswer === idx;
          return (
            <div
              key={answer.id}
              className="group relative rounded-2xl transition-all duration-200"
              style={{
                background: answer.isCorrect
                  ? `linear-gradient(135deg, ${gradStart}15, ${gradEnd}10)`
                  : isFocused
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(255,255,255,0.02)",
                border: `1.5px solid ${answer.isCorrect ? gradStart + "50" : isFocused ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)"}`,
                boxShadow: answer.isCorrect ? `0 4px 20px ${gradStart}15` : "none",
              }}
            >
              <div className="flex items-center gap-3 p-4">
                {/* Correct toggle */}
                <button
                  onClick={() => setCorrect(idx)}
                  title={answer.isCorrect ? "Correct answer" : "Mark as correct"}
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-all duration-200 hover:scale-110"
                  style={{
                    background: answer.isCorrect ? `linear-gradient(135deg, ${gradStart}, ${gradEnd})` : `${gradStart}20`,
                    color: answer.isCorrect ? "#fff" : gradStart,
                    boxShadow: answer.isCorrect ? `0 4px 14px ${gradStart}40` : "none",
                  }}
                >
                  {answer.isCorrect ? "✓" : String.fromCharCode(65 + idx)}
                </button>

                {/* Input */}
                <input
                  type="text"
                  value={answer.text}
                  onChange={(e) => updateAnswer(idx, e.target.value)}
                  onFocus={() => setFocusedAnswer(idx)}
                  onBlur={() => setFocusedAnswer(null)}
                  placeholder={`Answer ${String.fromCharCode(65 + idx)}${answer.isCorrect ? " (correct)" : ""}`}
                  className="flex-1 bg-transparent font-semibold text-white outline-none text-sm placeholder:text-[rgba(255,255,255,0.2)]"
                />

                {/* Remove */}
                {question.answers.length > 2 && (
                  <button
                    onClick={() => removeAnswer(idx)}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-[rgba(255,255,255,0.3)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add answer */}
      {question.answers.length < 6 && question.type !== "true_false" && (
        <button
          onClick={addAnswer}
          className="w-full py-3 rounded-2xl text-sm font-bold transition-all duration-200 mb-4"
          style={{
            border: "1.5px dashed rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.3)",
            background: "transparent",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)"; e.currentTarget.style.color = "#818cf8"; e.currentTarget.style.background = "rgba(99,102,241,0.04)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.3)"; e.currentTarget.style.background = "transparent"; }}
        >
          + Add answer option
        </button>
      )}

      {/* Explanation */}
      <div>
        <details className="group">
          <summary className="text-xs font-bold cursor-pointer select-none transition-colors" style={{ color: "rgba(255,255,255,0.3)" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#818cf8"}
            onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}>
            + Add explanation (shown after answer reveal)
          </summary>
          <textarea
            value={question.explanation || ""}
            onChange={(e) => onChange({ ...question, explanation: e.target.value })}
            placeholder="Why is this the correct answer?"
            rows={2}
            className="w-full mt-3 text-sm text-white rounded-2xl p-4 outline-none resize-none transition-all placeholder:text-[rgba(255,255,255,0.15)]"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            onFocus={(e) => { e.target.style.borderColor = "rgba(99,102,241,0.3)"; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.06)"; }}
          />
        </details>
      </div>
    </div>
  );
}

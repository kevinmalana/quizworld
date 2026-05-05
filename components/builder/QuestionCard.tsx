"use client";

import { useState } from "react";
import { AnswerEditor, type AnswerData } from "./AnswerEditor";

export type QuestionType = "multiple_choice" | "true_false" | "poll";

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
    // If we removed the correct one, make first one correct
    if (question.answers[i].isCorrect && newAnswers.length > 0) {
      newAnswers[0].isCorrect = true;
    }
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
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          {/* Question number */}
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-display font-black text-sm text-white"
            style={{ background: isReady ? "var(--success)" : errorCount > 0 ? "var(--primary)" : "var(--accent)" }}
          >
            {index + 1}
          </div>

          {/* Status pill */}
          <span
            className="px-2.5 py-1 rounded-full text-xs font-bold"
            style={{
              background: isReady ? "var(--success-light)" : errorCount > 0 ? "var(--primary-light)" : "var(--bg)",
              color: isReady ? "var(--success)" : errorCount > 0 ? "var(--primary)" : "var(--muted)",
            }}
          >
            {isReady ? "Ready" : `${issues.length} issue${issues.length === 1 ? "" : "s"}`}
          </span>

          {/* Question type selector */}
          <div className="flex items-center gap-1 ml-2">
            {([
              { key: "multiple_choice" as const, label: "MC", icon: "◉" },
              { key: "true_false" as const, label: "T/F", icon: "⚖" },
              { key: "poll" as const, label: "Poll", icon: "📊" },
            ]).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setType(key)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: question.type === key ? "var(--accent)" : "var(--bg)",
                  color: question.type === key ? "#fff" : "var(--muted)",
                  border: question.type === key ? "none" : "1px solid var(--line)",
                }}
                title={label}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:bg-[var(--bg)] transition-colors"
            style={{ background: showSettings ? "var(--accent-light)" : undefined, color: showSettings ? "var(--accent)" : undefined }}
            title="Question settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" /><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83" />
            </svg>
          </button>
          <button
            onClick={onDuplicate}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:bg-[var(--bg)] transition-colors"
            title="Duplicate question"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete question"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Inline issues ── */}
      {issues.length > 0 && (
        <div className="rounded-xl p-3 mb-3 space-y-1" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
          {issues.map((issue) => (
            <p key={issue.message} className="text-xs font-semibold flex items-center gap-1.5"
              style={{ color: issue.severity === "error" ? "var(--primary)" : "#b45309" }}>
              <span>{issue.severity === "error" ? "⚠" : "◦"}</span>
              {issue.message}
            </p>
          ))}
        </div>
      )}

      {/* ── Settings panel (collapsible) ── */}
      {showSettings && (
        <div className="rounded-2xl p-4 mb-3 flex flex-wrap gap-4 items-center" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
          {/* Time */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">⏱ Time</span>
            <div className="flex gap-1">
              {TIME_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => onChange({ ...question, timeLimit: t })}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: question.timeLimit === t ? "var(--accent)" : "var(--surface)",
                    color: question.timeLimit === t ? "#fff" : "var(--ink)",
                    border: question.timeLimit === t ? "none" : "1px solid var(--line)",
                  }}
                >
                  {t}s
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-6" style={{ background: "var(--line)" }} />

          {/* Points */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">⭐ Points</span>
            <div className="flex gap-1">
              {POINT_OPTIONS.map((pt) => (
                <button
                  key={pt}
                  onClick={() => onChange({ ...question, points: pt })}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: question.points === pt ? "#d97706" : "var(--surface)",
                    color: question.points === pt ? "#fff" : "var(--ink)",
                    border: question.points === pt ? "none" : "1px solid var(--line)",
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
      <div className="mb-4">
        <textarea
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          placeholder="Type your question here…"
          rows={2}
          className="w-full font-display font-bold text-lg text-[var(--ink)] rounded-2xl p-4 outline-none resize-none transition-all"
          style={{
            border: "1.5px solid var(--line)",
            lineHeight: 1.5,
            background: "var(--surface)",
          }}
          onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 3px var(--accent-glow)"; }}
          onBlur={(e) => { e.target.style.borderColor = "var(--line)"; e.target.style.boxShadow = "none"; }}
        />
      </div>

      {/* ── Answers ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
        {question.answers.map((answer, idx) => (
          <AnswerEditor
            key={answer.id}
            answer={answer}
            index={idx}
            onChange={(text) => updateAnswer(idx, text)}
            onCorrect={() => setCorrect(idx)}
            onRemove={() => removeAnswer(idx)}
            canRemove={question.answers.length > 2}
          />
        ))}
      </div>

      {/* Add answer button */}
      {question.answers.length < 6 && question.type !== "true_false" && (
        <button
          onClick={addAnswer}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
          style={{ border: "1.5px dashed var(--line)", background: "transparent" }}
        >
          + Add answer option
        </button>
      )}

      {/* ── Explanation (optional) ── */}
      <div className="mt-3">
        <details className="group">
          <summary className="text-xs font-bold text-[var(--muted)] cursor-pointer hover:text-[var(--accent)] transition-colors select-none">
            + Add explanation (shown after answer reveal)
          </summary>
          <textarea
            value={question.explanation || ""}
            onChange={(e) => onChange({ ...question, explanation: e.target.value })}
            placeholder="Why is this the correct answer? This will be shown to players after they answer."
            rows={2}
            className="w-full mt-2 text-sm text-[var(--ink)] rounded-xl p-3 outline-none resize-none"
            style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
          />
        </details>
      </div>
    </div>
  );
}

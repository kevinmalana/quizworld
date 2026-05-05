"use client";

import { useState } from "react";

export type QuestionType = "multiple_choice" | "true_false" | "poll";

export interface AnswerData {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuestionData {
  id: string;
  text: string;
  type: QuestionType;
  answers: AnswerData[];
  timeLimit: number;
  points: number;
  explanation?: string;
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
  if (!q.text.trim()) issues.push({ message: "Add a question", severity: "error" });
  const filled = q.answers.filter((a) => a.text.trim()).length;
  if (filled < q.answers.length) issues.push({ message: "Fill in all answers", severity: "error" });
  if (q.type !== "poll") {
    const correct = q.answers.filter((a) => a.isCorrect).length;
    if (correct !== 1) issues.push({ message: "Pick a correct answer", severity: "error" });
  }
  return issues;
}

export function QuestionCard({ question, index, total, onChange, onDelete, onDuplicate }: Props) {
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
      onChange({ ...question, type, answers: [{ id: uid(), text: "True", isCorrect: true }, { id: uid(), text: "False", isCorrect: false }] });
    } else if (type === "poll") {
      onChange({ ...question, type, answers: question.answers.map((a) => ({ ...a, isCorrect: false })) });
    } else {
      onChange({ ...question, type });
    }
  };

  const answerColors = [
    { bg: "var(--answer-a-surface)", border: "var(--answer-a)", text: "var(--answer-a)" },
    { bg: "var(--answer-b-surface)", border: "var(--answer-b)", text: "var(--answer-b)" },
    { bg: "var(--answer-c-surface)", border: "var(--answer-c)", text: "var(--answer-c)" },
    { bg: "var(--answer-d-surface)", border: "var(--answer-d)", text: "var(--answer-d)" },
    { bg: "var(--accent-light)", border: "var(--accent)", text: "var(--accent)" },
    { bg: "var(--accent-light)", border: "var(--accent)", text: "var(--accent)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
      {/* Question text — the hero */}
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", top: "-0.5rem", left: "0.75rem", padding: "0 0.375rem", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", background: "var(--bg)" }}>
          Question {index + 1}
        </div>
        <textarea
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          placeholder="Type your question here…"
          rows={3}
          style={{
            width: "100%", border: "1.5px solid var(--line)", borderRadius: "var(--radius-lg)",
            padding: "1.25rem", fontSize: "1.125rem", fontWeight: 700, color: "var(--ink)",
            fontFamily: "var(--font-display)", lineHeight: 1.6, resize: "none",
            background: "var(--surface)", outline: "none", transition: "border-color 0.2s, box-shadow 0.2s",
          }}
          onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 3px var(--accent-glow)"; }}
          onBlur={(e) => { e.target.style.borderColor = "var(--line)"; e.target.style.boxShadow = "none"; }}
        />
      </div>

      {/* Answer grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        {question.answers.map((answer, idx) => {
          const c = answerColors[idx];
          return (
            <div key={answer.id} style={{
              border: `1.5px solid ${answer.isCorrect ? c.border : "var(--line)"}`,
              borderRadius: "var(--radius-lg)",
              background: answer.isCorrect ? c.bg : "var(--surface)",
              padding: "1rem",
              display: "flex", alignItems: "center", gap: "0.75rem",
              transition: "all 0.15s",
              cursor: "pointer",
            }}
              onClick={() => setCorrect(idx)}
            >
              {/* Answer marker */}
              <div style={{
                width: "2.5rem", height: "2.5rem", borderRadius: "var(--radius-md)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: "1rem", flexShrink: 0,
                background: answer.isCorrect ? c.border : c.bg,
                color: answer.isCorrect ? "#fff" : c.text,
                boxShadow: answer.isCorrect ? `0 2px 8px ${c.border}40` : "none",
              }}>
                {answer.isCorrect ? "✓" : String.fromCharCode(65 + idx)}
              </div>
              {/* Input */}
              <input
                type="text"
                value={answer.text}
                onChange={(e) => updateAnswer(idx, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder={`Answer ${String.fromCharCode(65 + idx)}`}
                style={{
                  flex: 1, border: "none", background: "transparent",
                  fontWeight: 600, fontSize: "0.9375rem", color: "var(--ink)",
                  outline: "none", fontFamily: "var(--font-body)",
                }}
              />
              {/* Remove */}
              {question.answers.length > 2 && (
                <button onClick={(e) => { e.stopPropagation(); removeAnswer(idx); }}
                  style={{ width: "1.5rem", height: "1.5rem", borderRadius: "var(--radius-sm)", border: "none", background: "transparent", color: "var(--faint)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", opacity: 0.5 }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; e.currentTarget.style.color = "var(--faint)"; }}
                >✕</button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add answer */}
      {question.answers.length < 6 && question.type !== "true_false" && (
        <button onClick={addAnswer} className="btn btn-sm btn-secondary" style={{ width: "100%", borderStyle: "dashed" }}>
          + Add answer
        </button>
      )}

      {/* Settings row — always visible */}
      <div className="card" style={{ padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", borderRadius: "var(--radius-md)" }}>
        {/* Type */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          {(["multiple_choice", "true_false", "poll"] as const).map((key) => (
            <button key={key} onClick={() => setType(key)}
              className={question.type === key ? "btn btn-sm btn-primary" : "btn btn-sm btn-ghost"}
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem" }}>
              {key === "multiple_choice" ? "◉ MC" : key === "true_false" ? "⚖ T/F" : "📊 Poll"}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: "1.25rem", background: "var(--line)" }} />
        {/* Time */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)" }}>⏱</span>
          {TIME_OPTIONS.map((t) => (
            <button key={t} onClick={() => onChange({ ...question, timeLimit: t })}
              className={question.timeLimit === t ? "btn btn-sm btn-primary" : "btn btn-sm btn-ghost"}
              style={{ padding: "0.2rem 0.375rem", fontSize: "0.7rem" }}>{t}s</button>
          ))}
        </div>
        <div style={{ width: 1, height: "1.25rem", background: "var(--line)" }} />
        {/* Points */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)" }}>⭐</span>
          {POINT_OPTIONS.map((pt) => (
            <button key={pt} onClick={() => onChange({ ...question, points: pt })}
              className={question.points === pt ? "btn btn-sm btn-accent" : "btn btn-sm btn-ghost"}
              style={{ padding: "0.2rem 0.375rem", fontSize: "0.7rem" }}>{pt}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {/* Actions */}
        <button onClick={onDuplicate} className="btn btn-sm btn-ghost" style={{ fontSize: "0.7rem" }}>⧉ Duplicate</button>
        <button onClick={onDelete} className="btn btn-sm btn-ghost" style={{ fontSize: "0.7rem", color: "var(--primary)" }}>✕ Delete</button>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="tag tag-primary" style={{ fontSize: "0.7rem" }}>
          ⚠ {issues.map((i) => i.message).join(" · ")}
        </div>
      )}

      {/* Explanation */}
      <details>
        <summary style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", cursor: "pointer" }}>+ Add explanation (shown after answer reveal)</summary>
        <textarea value={question.explanation || ""} onChange={(e) => onChange({ ...question, explanation: e.target.value })}
          placeholder="Why is this the correct answer?" rows={2}
          className="input" style={{ marginTop: "0.5rem", fontSize: "0.875rem", resize: "none" }} />
      </details>
    </div>
  );
}

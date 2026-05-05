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

function getIssues(q: QuestionData): string[] {
  const issues: string[] = [];
  if (!q.text.trim()) issues.push("Add a question");
  const filled = q.answers.filter((a) => a.text.trim()).length;
  if (filled < q.answers.length) issues.push("Fill all answers");
  if (q.type !== "poll" && q.answers.filter((a) => a.isCorrect).length !== 1) issues.push("Pick correct answer");
  return issues;
}

export function QuestionCard({ question, index, total, onChange, onDelete, onDuplicate }: Props) {
  const issues = getIssues(question);
  const isReady = issues.length === 0;

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
    if (type === "true_false") onChange({ ...question, type, answers: [{ id: uid(), text: "True", isCorrect: true }, { id: uid(), text: "False", isCorrect: false }] });
    else if (type === "poll") onChange({ ...question, type, answers: question.answers.map((a) => ({ ...a, isCorrect: false })) });
    else onChange({ ...question, type });
  };

  const colors = [
    { bg: "var(--answer-a-surface)", border: "var(--answer-a)", solid: "var(--answer-a)" },
    { bg: "var(--answer-b-surface)", border: "var(--answer-b)", solid: "var(--answer-b)" },
    { bg: "var(--answer-c-surface)", border: "var(--answer-c)", solid: "var(--answer-c)" },
    { bg: "var(--answer-d-surface)", border: "var(--answer-d)", solid: "var(--answer-d)" },
    { bg: "var(--accent-light)", border: "var(--accent)", solid: "var(--accent)" },
    { bg: "var(--accent-light)", border: "var(--accent)", solid: "var(--accent)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 520, margin: "0 auto", width: "100%" }}>
      {/* Status bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="tag" style={{ background: "var(--accent-light)", color: "var(--accent)", fontWeight: 800 }}>{index + 1}</span>
          <span className={isReady ? "tag tag-success" : "tag tag-primary"} style={{ fontSize: "0.7rem" }}>
            {isReady ? "✓ Ready" : issues.join(" · ")}
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button onClick={onDuplicate} className="btn btn-sm btn-ghost" style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem" }}>⧉ Copy</button>
          <button onClick={onDelete} className="btn btn-sm btn-ghost" style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", color: "var(--primary)" }}>✕ Delete</button>
        </div>
      </div>

      {/* Question text */}
      <textarea
        value={question.text} onChange={(e) => onChange({ ...question, text: e.target.value })}
        placeholder="Type your question…"
        rows={3}
        className="input input-lg"
        style={{ fontWeight: 700, fontSize: "1.125rem", resize: "none", fontFamily: "var(--font-display)" }}
      />

      {/* Answers — single column, big */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {question.answers.map((answer, idx) => {
          const c = colors[idx];
          return (
            <div key={answer.id} style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.875rem 1rem",
              border: `1.5px solid ${answer.isCorrect ? c.border : "var(--line)"}`,
              borderRadius: "var(--radius-lg)",
              background: answer.isCorrect ? c.bg : "var(--surface)",
              transition: "all 0.15s",
            }}>
              {/* Marker — click to mark correct */}
              <button onClick={() => setCorrect(idx)} style={{
                width: "2.75rem", height: "2.75rem", borderRadius: "var(--radius-md)", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: "1.125rem", cursor: "pointer", flexShrink: 0,
                background: answer.isCorrect ? c.solid : c.bg,
                color: answer.isCorrect ? "#fff" : c.solid,
                boxShadow: answer.isCorrect ? `0 2px 10px ${c.solid}30` : "none",
              }}>
                {answer.isCorrect ? "✓" : String.fromCharCode(65 + idx)}
              </button>
              {/* Input */}
              <input type="text" value={answer.text} onChange={(e) => updateAnswer(idx, e.target.value)}
                placeholder={`Answer ${String.fromCharCode(65 + idx)}`}
                style={{ flex: 1, border: "none", background: "transparent", fontWeight: 600, fontSize: "1rem", color: "var(--ink)", outline: "none" }} />
              {/* Remove */}
              {question.answers.length > 2 && (
                <button onClick={() => removeAnswer(idx)} style={{
                  width: "2rem", height: "2rem", borderRadius: "var(--radius-sm)", border: "none",
                  background: "transparent", color: "var(--faint)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.875rem",
                }}>✕</button>
              )}
            </div>
          );
        })}
      </div>

      {question.answers.length < 6 && question.type !== "true_false" && (
        <button onClick={addAnswer} className="btn btn-secondary" style={{ width: "100%", borderStyle: "dashed" }}>+ Add answer</button>
      )}

      {/* Settings — compact row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", paddingTop: "0.5rem", borderTop: "1px solid var(--line)" }}>
        {/* Type */}
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {(["multiple_choice", "true_false", "poll"] as const).map((k) => (
            <button key={k} onClick={() => setType(k)} className={question.type === k ? "btn btn-sm btn-primary" : "btn btn-sm btn-ghost"} style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}>
              {k === "multiple_choice" ? "◉ MC" : k === "true_false" ? "⚖ T/F" : "📊 Poll"}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: "1.25rem", background: "var(--line)" }} />
        {/* Time */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>⏱</span>
          {TIME_OPTIONS.map((t) => (
            <button key={t} onClick={() => onChange({ ...question, timeLimit: t })} className={question.timeLimit === t ? "btn btn-sm btn-primary" : "btn btn-sm btn-ghost"} style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>{t}s</button>
          ))}
        </div>
        <div style={{ width: 1, height: "1.25rem", background: "var(--line)" }} />
        {/* Points */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>⭐</span>
          {POINT_OPTIONS.map((pt) => (
            <button key={pt} onClick={() => onChange({ ...question, points: pt })} className={question.points === pt ? "btn btn-sm btn-accent" : "btn btn-sm btn-ghost"} style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>{pt}</button>
          ))}
        </div>
      </div>

      {/* Explanation */}
      <details>
        <summary style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)", cursor: "pointer" }}>+ Add explanation</summary>
        <textarea value={question.explanation || ""} onChange={(e) => onChange({ ...question, explanation: e.target.value })}
          placeholder="Why is this correct?" rows={2} className="input" style={{ marginTop: "0.5rem", resize: "none" }} />
      </details>
    </div>
  );
}

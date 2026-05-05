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
  if (!q.text.trim()) issues.push({ message: "Question text is missing", severity: "error" });
  const filled = q.answers.filter((a) => a.text.trim()).length;
  if (filled < q.answers.length) issues.push({ message: "Some answers are blank", severity: "error" });
  if (q.type !== "poll") {
    const correct = q.answers.filter((a) => a.isCorrect).length;
    if (correct !== 1) issues.push({ message: "Mark exactly one correct answer", severity: "error" });
  }
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

  const ANSWER_VARS = ["--answer-a", "--answer-b", "--answer-c", "--answer-d", "--accent", "--accent"];
  const ANSWER_SURFACES = ["--answer-a-surface", "--answer-b-surface", "--answer-c-surface", "--answer-d-surface", "--accent-light", "--accent-light"];

  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div className="tag" style={{ background: isReady ? "var(--success-light)" : errorCount > 0 ? "var(--primary-light)" : "var(--accent-light)", color: isReady ? "var(--success)" : errorCount > 0 ? "var(--primary)" : "var(--accent)" }}>
            {index + 1}
          </div>
          <span className="tag" style={{ background: isReady ? "var(--success-light)" : errorCount > 0 ? "var(--primary-light)" : "var(--bg-subtle)", color: isReady ? "var(--success)" : errorCount > 0 ? "var(--primary)" : "var(--muted)" }}>
            {isReady ? "Ready" : `${issues.length} issue${issues.length > 1 ? "s" : ""}`}
          </span>
          <div style={{ display: "flex", gap: "0.25rem", marginLeft: "0.25rem" }}>
            {(["multiple_choice", "true_false", "poll"] as const).map((key) => (
              <button key={key} onClick={() => setType(key)}
                className={question.type === key ? "btn btn-sm btn-primary" : "btn btn-sm btn-ghost"}
                style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem" }}>
                {key === "multiple_choice" ? "◉ MC" : key === "true_false" ? "⚖ T/F" : "📊 Poll"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.125rem" }}>
          <button onClick={() => setShowSettings(!showSettings)} className="btn btn-sm btn-ghost" style={{ padding: "0.25rem 0.375rem" }} title="Settings">⚙</button>
          <button onClick={onDuplicate} className="btn btn-sm btn-ghost" style={{ padding: "0.25rem 0.375rem" }} title="Duplicate">⧉</button>
          <button onClick={onDelete} className="btn btn-sm btn-ghost" style={{ padding: "0.25rem 0.375rem", color: "var(--primary)" }} title="Delete">✕</button>
        </div>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="card" style={{ background: "var(--primary-light)", border: "1px solid var(--primary)", padding: "0.5rem 0.75rem", marginBottom: "0.75rem", borderRadius: "var(--radius-sm)" }}>
          {issues.map((issue) => (
            <p key={issue.message} style={{ fontSize: "0.7rem", fontWeight: 600, color: issue.severity === "error" ? "var(--primary)" : "var(--warning)" }}>
              ⚠ {issue.message}
            </p>
          ))}
        </div>
      )}

      {/* Settings */}
      {showSettings && (
        <div className="card" style={{ background: "var(--bg-subtle)", padding: "0.75rem", marginBottom: "0.75rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", borderRadius: "var(--radius-sm)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>⏱</span>
            {TIME_OPTIONS.map((t) => (
              <button key={t} onClick={() => onChange({ ...question, timeLimit: t })}
                className={question.timeLimit === t ? "btn btn-sm btn-primary" : "btn btn-sm btn-secondary"}
                style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}>{t}s</button>
            ))}
          </div>
          <div style={{ width: 1, height: "1rem", background: "var(--line)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>⭐</span>
            {POINT_OPTIONS.map((pt) => (
              <button key={pt} onClick={() => onChange({ ...question, points: pt })}
                className={question.points === pt ? "btn btn-sm btn-accent" : "btn btn-sm btn-secondary"}
                style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}>{pt}</button>
            ))}
          </div>
        </div>
      )}

      {/* Question text */}
      <textarea value={question.text} onChange={(e) => onChange({ ...question, text: e.target.value })}
        placeholder="Type your question here…" rows={2}
        className="input" style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.75rem", resize: "none", fontFamily: "var(--font-display)" }} />

      {/* Answers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.5rem", marginBottom: "0.75rem" }}>
        {question.answers.map((answer, idx) => {
          const colorVar = ANSWER_VARS[idx] || "--accent";
          const surfVar = ANSWER_SURFACES[idx] || "--accent-light";
          return (
            <div key={answer.id} className="card" style={{
              padding: "0.625rem",
              background: answer.isCorrect ? `var(${surfVar})` : "var(--surface)",
              borderColor: answer.isCorrect ? `var(${colorVar})` : "var(--line)",
              borderWidth: answer.isCorrect ? "1.5px" : "1px",
              borderRadius: "var(--radius-md)",
              display: "flex", alignItems: "center", gap: "0.5rem",
            }}>
              <button onClick={() => setCorrect(idx)}
                style={{
                  width: "2rem", height: "2rem", borderRadius: "var(--radius-sm)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: "0.75rem", border: "none", cursor: "pointer",
                  background: answer.isCorrect ? `var(${colorVar})` : `var(${surfVar})`,
                  color: answer.isCorrect ? "#fff" : `var(${colorVar})`,
                }}>
                {answer.isCorrect ? "✓" : String.fromCharCode(65 + idx)}
              </button>
              <input type="text" value={answer.text} onChange={(e) => updateAnswer(idx, e.target.value)}
                placeholder={`Answer ${String.fromCharCode(65 + idx)}`}
                style={{ flex: 1, border: "none", background: "transparent", fontWeight: 600, fontSize: "0.8125rem", color: "var(--ink)", outline: "none" }} />
              {question.answers.length > 2 && (
                <button onClick={() => removeAnswer(idx)}
                  className="btn btn-sm btn-ghost" style={{ padding: "0.125rem", fontSize: "0.625rem", color: "var(--faint)" }}>✕</button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add answer */}
      {question.answers.length < 6 && question.type !== "true_false" && (
        <button onClick={addAnswer} className="btn btn-sm btn-secondary" style={{ width: "100%", marginBottom: "0.75rem", borderStyle: "dashed" }}>
          + Add answer option
        </button>
      )}

      {/* Explanation */}
      <details>
        <summary style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", cursor: "pointer" }}>+ Add explanation</summary>
        <textarea value={question.explanation || ""} onChange={(e) => onChange({ ...question, explanation: e.target.value })}
          placeholder="Why is this the correct answer?" rows={2}
          className="input" style={{ marginTop: "0.375rem", fontSize: "0.8125rem", resize: "none" }} />
      </details>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUpload } from "./ImageUpload";

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
  shuffleAnswers?: boolean;
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
  if (filled < 2) issues.push("Need 2+ answers");
  if (q.type !== "poll" && q.answers.filter((a) => a.isCorrect && a.text.trim()).length !== 1) issues.push("Pick correct answer");
  return issues;
}

export function QuestionCard({ question, index, total, onChange, onDelete, onDuplicate }: Props) {
  const issues = getIssues(question);
  const isReady = issues.length === 0;
  const containerRef = useRef<HTMLDivElement>(null);

  // Paste images from clipboard (#6)
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => {
            // Paste onto question image
            onChange({ ...question, imageUrl: reader.result as string });
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
    const el = containerRef.current;
    if (el) {
      el.addEventListener("paste", handlePaste);
      return () => el.removeEventListener("paste", handlePaste);
    }
  }, [question, onChange]);

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
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 640, margin: "0 auto", width: "100%" }}>
      {/* Status bar with inline completion indicators (#5) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="tag" style={{ background: "var(--accent-light)", color: "var(--accent)", fontWeight: 800 }}>{index + 1}</span>
          {/* Inline completion indicators */}
          <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
            <span title="Question text" style={{ fontSize: "0.7rem", color: question.text.trim() ? "var(--success)" : "var(--faint)" }}>{question.text.trim() ? "✓" : "○"}</span>
            <span title="All answers filled" style={{ fontSize: "0.7rem", color: question.answers.every((a) => a.text.trim()) ? "var(--success)" : "var(--faint)" }}>{question.answers.every((a) => a.text.trim()) ? "✓" : "○"}</span>
            <span title="Correct answer" style={{ fontSize: "0.7rem", color: question.answers.filter((a) => a.isCorrect).length === 1 ? "var(--success)" : "var(--faint)" }}>{question.answers.filter((a) => a.isCorrect).length === 1 ? "✓" : "○"}</span>
          </div>
          {!isReady && (
            <span className="tag tag-primary" style={{ fontSize: "0.65rem" }}>{issues.join(" · ")}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button onClick={onDuplicate} className="btn btn-sm btn-ghost" style={{ padding: "0.4375rem 0.75rem", fontSize: "0.75rem", minHeight: 36 }}>⧉ Copy</button>
          <button onClick={onDelete} className="btn btn-sm btn-ghost" style={{ padding: "0.4375rem 0.75rem", fontSize: "0.75rem", minHeight: 36, color: "var(--primary)" }}>✕ Delete</button>
        </div>
      </div>

      {/* Question text */}
      <textarea
        value={question.text} onChange={(e) => onChange({ ...question, text: e.target.value })}
        placeholder="Type your question…"
        rows={2}
        className="input input-lg"
        style={{ fontWeight: 700, fontSize: "1.125rem", resize: "none", fontFamily: "var(--font-display)" }}
      />

      {/* Question image */}
      <ImageUpload
        imageUrl={question.imageUrl}
        onUpload={(url) => onChange({ ...question, imageUrl: url })}
        onRemove={() => onChange({ ...question, imageUrl: undefined })}
        label="Add question image"
        compact
      />

      {/* Answers — single column, big */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {question.answers.map((answer, idx) => {
          const c = colors[idx];
          return (
            <div key={answer.id} style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.75rem 0.875rem",
              border: `1.5px solid ${answer.isCorrect ? c.border : "var(--line)"}`,
              borderRadius: "var(--radius-lg)",
              background: answer.isCorrect ? c.bg : "var(--surface)",
              transition: "all 0.15s",
            }}>
              {/* Marker — click to mark correct */}
              <button onClick={() => setCorrect(idx)} style={{
                width: "2.5rem", height: "2.5rem", borderRadius: "var(--radius-md)", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: "1rem", cursor: "pointer", flexShrink: 0,
                background: answer.isCorrect ? c.solid : c.bg,
                color: answer.isCorrect ? "#fff" : c.solid,
                boxShadow: answer.isCorrect ? `0 2px 10px ${c.solid}30` : "none",
              }}>
                {answer.isCorrect ? "✓" : String.fromCharCode(65 + idx)}
              </button>
              {/* Input */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <input type="text" value={answer.text} onChange={(e) => updateAnswer(idx, e.target.value)}
                  placeholder={`Answer ${String.fromCharCode(65 + idx)}`}
                  style={{ border: "none", background: "transparent", fontWeight: 600, fontSize: "1rem", color: "var(--ink)", outline: "none", width: "100%" }} />
                {answer.imageUrl && (
                  <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", maxWidth: 160 }}>
                    <img src={answer.imageUrl} alt="" style={{ width: "100%", maxHeight: 80, objectFit: "cover", display: "block" }} />
                    <button onClick={() => {
                      const newAnswers = question.answers.map((a, ai) => ai === idx ? { ...a, imageUrl: undefined } : a);
                      onChange({ ...question, answers: newAnswers });
                    }} style={{
                      position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%",
                      border: "none", background: "rgba(0,0,0,0.6)", color: "white", fontSize: "0.6rem",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>✕</button>
                  </div>
                )}
              </div>
              {/* Image toggle */}
              {!answer.imageUrl && (
                <button onClick={() => {
                  // Create and attach file input for mobile compatibility
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.style.display = 'none';
                  document.body.appendChild(input);
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      alert('Image must be under 5MB');
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      const newAnswers = question.answers.map((a, ai) => ai === idx ? { ...a, imageUrl: reader.result as string } : a);
                      onChange({ ...question, answers: newAnswers });
                    };
                    reader.onerror = () => alert('Failed to read image');
                    reader.readAsDataURL(file);
                    document.body.removeChild(input);
                  };
                  input.oncancel = () => document.body.removeChild(input);
                  input.click();
                }} style={{
                  width: "2.25rem", height: "2.25rem", borderRadius: "var(--radius-sm)", border: "none",
                  background: "transparent", color: "var(--faint)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.875rem",
                  transition: "color 0.15s",
                }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--faint)")}>🖼</button>
              )}
              {/* Remove */}
              {question.answers.length > 2 && (
                <button onClick={() => removeAnswer(idx)} style={{
                  width: "2.25rem", height: "2.25rem", borderRadius: "var(--radius-sm)", border: "none",
                  background: "transparent", color: "var(--faint)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.875rem",
                  transition: "color 0.15s",
                }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--faint)")}>✕</button>
              )}
            </div>
          );
        })}
      </div>

      {question.answers.length < 6 && question.type !== "true_false" && (
        <button onClick={addAnswer} className="btn btn-secondary" style={{ width: "100%", borderStyle: "dashed" }}>+ Add answer</button>
      )}

      {/* Settings — compact row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap", paddingTop: "0.375rem", borderTop: "1px solid var(--line)" }}>
        {/* Difficulty badge (#11) */}
        <span style={{
          fontSize: "0.65rem", fontWeight: 800, padding: "0.2rem 0.5rem", borderRadius: 999,
          background: question.timeLimit <= 10 || question.points >= 2000 ? "rgba(239,68,68,0.1)" : question.timeLimit >= 30 || question.points <= 500 ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
          color: question.timeLimit <= 10 || question.points >= 2000 ? "#ef4444" : question.timeLimit >= 30 || question.points <= 500 ? "#10b981" : "#f59e0b",
        }}>
          {question.timeLimit <= 10 || question.points >= 2000 ? "🔴 Hard" : question.timeLimit >= 30 || question.points <= 500 ? "🟢 Easy" : "🟡 Med"}
        </span>
        <span style={{ width: 1, height: "1rem", background: "var(--line)", flexShrink: 0 }} />
        {/* Type */}
        {(["multiple_choice", "true_false", "poll"] as const).map((k) => (
          <button key={k} onClick={() => setType(k)} className={question.type === k ? "btn btn-sm btn-primary" : "btn btn-sm btn-ghost"} style={{ padding: "0.4375rem 0.625rem", fontSize: "0.75rem", minHeight: 36 }}>
            {k === "multiple_choice" ? "◉ MC" : k === "true_false" ? "⚖ T/F" : "📊 Poll"}
          </button>
        ))}
        <span style={{ width: 1, height: "1rem", background: "var(--line)", flexShrink: 0 }} />
        {/* Time */}
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>⏱</span>
        {TIME_OPTIONS.map((t) => (
          <button key={t} onClick={() => onChange({ ...question, timeLimit: t })} className={question.timeLimit === t ? "btn btn-sm btn-primary" : "btn btn-sm btn-ghost"} style={{ padding: "0.375rem 0.5rem", fontSize: "0.75rem", minHeight: 36 }}>{t}s</button>
        ))}
        <span style={{ width: 1, height: "1rem", background: "var(--line)", flexShrink: 0 }} />
        {/* Points */}
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>⭐</span>
        {POINT_OPTIONS.map((pt) => (
          <button key={pt} onClick={() => onChange({ ...question, points: pt })} className={question.points === pt ? "btn btn-sm btn-accent" : "btn btn-sm btn-ghost"} style={{ padding: "0.375rem 0.5rem", fontSize: "0.75rem", minHeight: 36 }}>{pt}</button>
        ))}
        <span style={{ width: 1, height: "1rem", background: "var(--line)", flexShrink: 0 }} />
        {/* Shuffle toggle (#4) */}
        <button
          onClick={() => onChange({ ...question, shuffleAnswers: !question.shuffleAnswers })}
          className="btn btn-sm btn-ghost"
          style={{ padding: "0.375rem 0.5rem", fontSize: "0.75rem", minHeight: 36, color: question.shuffleAnswers ? "var(--accent)" : "var(--muted)" }}
          title="Shuffle answer order in game"
        >
          {question.shuffleAnswers ? "🔀 On" : "🔀 Off"}
        </button>
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

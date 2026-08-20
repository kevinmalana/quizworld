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
  videoUrl?: string;
  shuffleAnswers?: boolean;
}

interface Props {
  question: QuestionData;
  index: number;
  total: number;
  onChange: (q: QuestionData) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  compact?: boolean;
}

const TIME_OPTIONS = [10, 20, 30, 60];
const POINT_OPTIONS = [500, 1000, 2000];

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getIssues(q: QuestionData): string[] {
  const issues: string[] = [];
  if (!q.text.trim()) issues.push("Add a question");
  if (q.answers.length < 2) issues.push("Need 2+ answers");
  else if (q.answers.some((answer) => !answer.text.trim())) issues.push("Complete all answers");
  if (q.type !== "poll" && q.answers.filter((a) => a.isCorrect && a.text.trim()).length !== 1) issues.push("Pick correct answer");
  return issues;
}

export function QuestionCard({ question, index, total, onChange, onDelete, onDuplicate, compact }: Props) {
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

  return (
    <div ref={containerRef} className="builder-question-card">
      <div className="builder-question-status">
        <div className="builder-question-status__left">
          <span className="tag builder-question-number">{index + 1}</span>
          <div className="builder-question-indicators">
            <span title="Question text" className={question.text.trim() ? "builder-question-indicator is-complete" : "builder-question-indicator"}>{question.text.trim() ? "✓" : "○"}</span>
            <span title="All answers filled" className={question.answers.every((a) => a.text.trim()) ? "builder-question-indicator is-complete" : "builder-question-indicator"}>{question.answers.every((a) => a.text.trim()) ? "✓" : "○"}</span>
            <span title="Correct answer" className={question.answers.filter((a) => a.isCorrect).length === 1 ? "builder-question-indicator is-complete" : "builder-question-indicator"}>{question.answers.filter((a) => a.isCorrect).length === 1 ? "✓" : "○"}</span>
          </div>
          {!isReady && (
            <span className="tag tag-primary builder-question-issues">{issues.join(" · ")}</span>
          )}
        </div>
        <div className="builder-question-actions">
          <button onClick={onDuplicate} className="btn btn-sm btn-ghost builder-question-action">⧉ Copy</button>
          <button onClick={onDelete} className="btn btn-sm btn-ghost builder-question-action builder-question-action--danger">✕ Delete</button>
        </div>
      </div>

      {/* Question text */}
      <textarea
        value={question.text} onChange={(e) => onChange({ ...question, text: e.target.value })}
        placeholder="Type your question…"
        rows={2}
        className="input input-lg builder-question-text"
      />

      {/* Question image */}
      <ImageUpload
        imageUrl={question.imageUrl}
        onUpload={(url) => onChange({ ...question, imageUrl: url })}
        onRemove={() => onChange({ ...question, imageUrl: undefined })}
        label="Add question image"
        compact
      />

      {/* YouTube video */}
      {question.videoUrl ? (
        <div className="builder-question-video">
          <div className="builder-question-video__frame">
            <iframe
              src={`https://www.youtube.com/embed/${extractYouTubeId(question.videoUrl)}`}
              className="builder-question-video__iframe"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <button
            onClick={() => onChange({ ...question, videoUrl: undefined })}
            className="builder-question-video__remove"
          >✕</button>
        </div>
      ) : (
        <button
          onClick={() => {
            const url = prompt("Paste YouTube URL:");
            if (url && extractYouTubeId(url)) onChange({ ...question, videoUrl: url });
            else if (url) alert("Please enter a valid YouTube URL");
          }}
          className="builder-question-video-add"
        >
          🎬 Add YouTube video
        </button>
      )}

      {/* Instruction for picking correct answer */}
      <div className={question.answers.filter((a) => a.isCorrect).length === 1 ? "builder-correct-hint is-selected" : "builder-correct-hint"}>
        {question.answers.filter((a) => a.isCorrect).length === 1
          ? "✅ Correct answer selected"
          : "👉 Tap a letter (A, B, C, D) to pick the correct answer"}
      </div>

      {/* Answers — single column, big */}
      <div className="builder-answer-list">
        {question.answers.map((answer, idx) => {
          return (
            <div key={answer.id} className={`builder-answer-row builder-answer-row--${idx} ${answer.isCorrect ? "is-correct" : ""}`}>
              {/* Marker — click to mark correct */}
              <button onClick={() => setCorrect(idx)} className="builder-answer-marker">
                {answer.isCorrect ? "✓" : String.fromCharCode(65 + idx)}
              </button>
              {/* Input */}
              <div className="builder-answer-content">
                <input type="text" value={answer.text} onChange={(e) => updateAnswer(idx, e.target.value)}
                  placeholder={`Answer ${String.fromCharCode(65 + idx)}`}
                  className="builder-answer-input" />
                {answer.imageUrl && (
                  <div className="builder-answer-image">
                    <img src={answer.imageUrl} alt="" className="builder-answer-image__img" />
                    <button onClick={() => {
                      const newAnswers = question.answers.map((a, ai) => ai === idx ? { ...a, imageUrl: undefined } : a);
                      onChange({ ...question, answers: newAnswers });
                    }} className="builder-answer-image__remove">✕</button>
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
                }} className="builder-answer-icon-button builder-answer-icon-button--image">🖼</button>
              )}
              {/* Remove */}
              {question.answers.length > 2 && (
                <button onClick={() => removeAnswer(idx)} className="builder-answer-icon-button builder-answer-icon-button--remove">✕</button>
              )}
            </div>
          );
        })}
      </div>

      {question.answers.length < 6 && question.type !== "true_false" && (
        <button onClick={addAnswer} className="btn btn-secondary builder-add-answer">+ Add answer</button>
      )}

      {/* Settings — hidden in compact mode (moved to properties panel) */}
      {!compact && (<>
      <div className="builder-question-settings">
        {/* Difficulty badge (#11) */}
        <span className={question.timeLimit <= 10 || question.points >= 2000 ? "builder-difficulty is-hard" : question.timeLimit >= 30 || question.points <= 500 ? "builder-difficulty is-easy" : "builder-difficulty is-medium"}>
          {question.timeLimit <= 10 || question.points >= 2000 ? "🔴 Hard" : question.timeLimit >= 30 || question.points <= 500 ? "🟢 Easy" : "🟡 Med"}
        </span>
        <span className="builder-settings-divider" />
        {/* Type */}
        {(["multiple_choice", "true_false", "poll"] as const).map((k) => (
          <button key={k} onClick={() => setType(k)} className={question.type === k ? "btn btn-sm btn-primary builder-settings-button" : "btn btn-sm btn-ghost builder-settings-button"}>
            {k === "multiple_choice" ? "◉ MC" : k === "true_false" ? "⚖ T/F" : "📊 Poll"}
          </button>
        ))}
        <span className="builder-settings-divider" />
        {/* Time */}
        <span className="builder-settings-icon">⏱</span>
        {TIME_OPTIONS.map((t) => (
          <button key={t} onClick={() => onChange({ ...question, timeLimit: t })} className={question.timeLimit === t ? "btn btn-sm btn-primary builder-settings-button" : "btn btn-sm btn-ghost builder-settings-button"}>{t}s</button>
        ))}
        <span className="builder-settings-divider" />
        {/* Points */}
        <span className="builder-settings-icon">⭐</span>
        {POINT_OPTIONS.map((pt) => (
          <button key={pt} onClick={() => onChange({ ...question, points: pt })} className={question.points === pt ? "btn btn-sm btn-accent builder-settings-button" : "btn btn-sm btn-ghost builder-settings-button"}>{pt}</button>
        ))}
        <span className="builder-settings-divider" />
        {/* Shuffle toggle (#4) */}
        <button
          onClick={() => onChange({ ...question, shuffleAnswers: !question.shuffleAnswers })}
          className={question.shuffleAnswers ? "btn btn-sm btn-ghost builder-settings-button builder-shuffle-toggle is-on" : "btn btn-sm btn-ghost builder-settings-button builder-shuffle-toggle"}
          title="Shuffle answer order in game"
        >
          {question.shuffleAnswers ? "🔀 On" : "🔀 Off"}
        </button>
      </div>

      {/* Explanation */}
      <details className="builder-explanation">
        <summary className="builder-explanation__summary">+ Add explanation</summary>
        <textarea value={question.explanation || ""} onChange={(e) => onChange({ ...question, explanation: e.target.value })}
          placeholder="Why is this correct?" rows={2} className="input builder-explanation__text" />
      </details>
      </>)}
    </div>
  );
}

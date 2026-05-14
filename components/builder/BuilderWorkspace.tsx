"use client";

import { BuilderToolbar } from "@/components/builder/BuilderToolbar";
import { Confetti } from "@/components/builder/Confetti";
import { LivePreview } from "@/components/builder/LivePreview";
import { QuestionCard, type QuestionData, type QuestionType } from "@/components/builder/QuestionCard";
import { QuestionSidebar } from "@/components/builder/QuestionSidebar";
import { useState } from "react";

export type DraftSyncState = "idle" | "dirty" | "saving" | "saved" | "error";

type BuilderWorkspaceProps = {
  title: string;
  category: string;
  emoji: string;
  isPublic: boolean;
  questions: QuestionData[];
  activeIndex: number;
  readyCount: number;
  draftState: DraftSyncState;
  canPublish: boolean;
  showPreview: boolean;
  showConfetti: boolean;
  isEditing: boolean;
  isSignedIn: boolean;
  onTitleChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onEmojiChange: (value: string) => void;
  onPublicChange: (value: boolean) => void;
  onSaveDraft: () => void;
  onPreview: () => void;
  onPublish: () => void;
  onBack: () => void;
  onSelectQuestion: (index: number) => void;
  onReorderQuestions: (from: number, to: number) => void;
  onAddQuestion: () => void;
  onAddTrueFalse: () => void;
  onUpdateQuestion: (index: number, question: QuestionData) => void;
  onDeleteQuestion: (index: number) => void;
  onDuplicateQuestion: (index: number) => void;
  onEnrich?: () => void;
  enriching?: boolean;
};

export function BuilderWorkspace({
  title,
  category,
  emoji,
  isPublic,
  questions,
  activeIndex,
  readyCount,
  draftState,
  canPublish,
  showPreview,
  showConfetti,
  isEditing,
  isSignedIn,
  onTitleChange,
  onCategoryChange,
  onEmojiChange,
  onPublicChange,
  onSaveDraft,
  onPreview,
  onPublish,
  onBack,
  onSelectQuestion,
  onReorderQuestions,
  onAddQuestion,
  onAddTrueFalse,
  onUpdateQuestion,
  onDeleteQuestion,
  onDuplicateQuestion,
  onEnrich,
  enriching,
}: BuilderWorkspaceProps) {
  const activeQuestion = questions[activeIndex] || null;
  const [showMobileProps, setShowMobileProps] = useState(false);

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col">
      {showConfetti && <Confetti />}
      <BuilderToolbar
        title={title}
        category={category}
        emoji={emoji}
        isPublic={isPublic}
        questionCount={questions.length}
        readyCount={readyCount}
        draftState={draftState}
        canPublish={canPublish}
        onTitleChange={onTitleChange}
        onCategoryChange={onCategoryChange}
        onEmojiChange={onEmojiChange}
        onPublicChange={onPublicChange}
        onSaveDraft={onSaveDraft}
        onPreview={onPreview}
        onPublish={onPublish}
        onBack={onBack}
        isEditing={isEditing}
        isSignedIn={isSignedIn}
      />

      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {/* Left sidebar — question list */}
        <div className="card sidebar-desktop builder-sidebar">
          <QuestionSidebar
            questions={questions}
            activeIndex={activeIndex}
            onSelect={onSelectQuestion}
            onReorder={onReorderQuestions}
            onAdd={onAddQuestion}
            onDelete={onDeleteQuestion}
            onDuplicate={onDuplicateQuestion}
          />
        </div>

        {/* Center — question editor */}
        <div className="flex-1 overflow-y-auto builder-editor-surface">
          {showPreview && activeQuestion && (
            <LivePreview question={activeQuestion} index={activeIndex} total={questions.length} onClose={onPreview} />
          )}

          {activeQuestion ? (
            <div style={{ maxWidth: 560, margin: "0 auto", padding: "0.5rem 0" }}>
              <QuestionCard
                question={activeQuestion}
                index={activeIndex}
                total={questions.length}
                onChange={(question) => onUpdateQuestion(activeIndex, question)}
                onDelete={() => onDeleteQuestion(activeIndex)}
                onDuplicate={() => onDuplicateQuestion(activeIndex)}
                compact
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[var(--muted)]">Add a question to get started</p>
            </div>
          )}
        </div>

        {/* Right — properties panel (desktop only) */}
        <div className="builder-props-panel">
          {activeQuestion ? (
            <PropertiesPanel
              question={activeQuestion}
              index={activeIndex}
              total={questions.length}
              questions={questions}
              enriching={enriching}
              onChange={(q) => onUpdateQuestion(activeIndex, q)}
              onPrevious={() => onSelectQuestion(Math.max(activeIndex - 1, 0))}
              onNext={() => activeIndex < questions.length - 1 ? onSelectQuestion(activeIndex + 1) : onAddQuestion()}
              onAddQuestion={onAddQuestion}
              onAddTrueFalse={onAddTrueFalse}
              onEnrich={onEnrich}
            />
          ) : (
            <div style={{ padding: "1.5rem", textAlign: "center" }}>
              <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Select a question to edit its properties</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: floating properties toggle */}
      {activeQuestion && (
        <button
          onClick={() => setShowMobileProps(!showMobileProps)}
          className="md:hidden"
          style={{
            position: "fixed", bottom: 16, right: 16, zIndex: 50,
            width: 48, height: 48, borderRadius: "50%",
            background: "var(--accent)", color: "#fff", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            cursor: "pointer",
          }}
          aria-label="Toggle properties"
        >
          ⚙️
        </button>
      )}

      {/* Mobile: properties drawer */}
      {showMobileProps && activeQuestion && (
        <div className="md:hidden" style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 45,
          maxHeight: "70vh", overflowY: "auto",
          background: "var(--surface)", borderTop: "1px solid var(--line)",
          borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
          padding: "1rem",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--ink)" }}>Question Properties</span>
            <button onClick={() => setShowMobileProps(false)} style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "var(--muted)" }}>✕</button>
          </div>
          <PropertiesPanel
            question={activeQuestion}
            index={activeIndex}
            total={questions.length}
            questions={questions}
            enriching={enriching}
            onChange={(q) => onUpdateQuestion(activeIndex, q)}
            onPrevious={() => onSelectQuestion(Math.max(activeIndex - 1, 0))}
            onNext={() => activeIndex < questions.length - 1 ? onSelectQuestion(activeIndex + 1) : onAddQuestion()}
            onAddQuestion={onAddQuestion}
            onAddTrueFalse={onAddTrueFalse}
            onEnrich={onEnrich}
          />
        </div>
      )}
    </div>
  );
}

// ── Properties Panel ───────────────────────────────────────────

const TIME_OPTIONS = [10, 20, 30, 60];
const POINT_OPTIONS = [500, 1000, 2000];

function PropertiesPanel({
  question, index, total, questions, enriching,
  onChange, onPrevious, onNext, onAddQuestion, onAddTrueFalse, onEnrich,
}: {
  question: QuestionData;
  index: number;
  total: number;
  questions: QuestionData[];
  enriching?: boolean;
  onChange: (q: QuestionData) => void;
  onPrevious: () => void;
  onNext: () => void;
  onAddQuestion: () => void;
  onAddTrueFalse: () => void;
  onEnrich?: () => void;
}) {
  const setType = (type: QuestionType) => {
    if (type === "true_false") {
      onChange({ ...question, type, answers: [
        { id: crypto.randomUUID?.() || Math.random().toString(36).slice(2), text: "True", isCorrect: true },
        { id: crypto.randomUUID?.() || Math.random().toString(36).slice(2), text: "False", isCorrect: false },
      ] });
    } else if (type === "poll") {
      onChange({ ...question, type, answers: question.answers.map((a) => ({ ...a, isCorrect: false })) });
    } else {
      onChange({ ...question, type });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", height: "100%" }}>
      {/* Section: Question Type */}
      <PropsSection label="Question Type">
        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
          {(["multiple_choice", "true_false", "poll"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                ...chipStyle,
                background: question.type === t ? "var(--accent)" : "var(--bg-subtle)",
                color: question.type === t ? "#fff" : "var(--ink)",
                borderColor: question.type === t ? "var(--accent)" : "var(--line)",
              }}
            >
              {t === "multiple_choice" ? "◉ MC" : t === "true_false" ? "⚖ T/F" : "📊 Poll"}
            </button>
          ))}
        </div>
      </PropsSection>

      {/* Section: Timing */}
      <PropsSection label="Time Limit">
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {TIME_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => onChange({ ...question, timeLimit: t })}
              style={{
                ...chipStyle,
                flex: 1,
                justifyContent: "center",
                background: question.timeLimit === t ? "var(--accent)" : "var(--bg-subtle)",
                color: question.timeLimit === t ? "#fff" : "var(--ink)",
                borderColor: question.timeLimit === t ? "var(--accent)" : "var(--line)",
              }}
            >
              {t}s
            </button>
          ))}
        </div>
      </PropsSection>

      {/* Section: Points */}
      <PropsSection label="Points">
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {POINT_OPTIONS.map((pt) => (
            <button
              key={pt}
              onClick={() => onChange({ ...question, points: pt })}
              style={{
                ...chipStyle,
                flex: 1,
                justifyContent: "center",
                background: question.points === pt ? "var(--accent)" : "var(--bg-subtle)",
                color: question.points === pt ? "#fff" : "var(--ink)",
                borderColor: question.points === pt ? "var(--accent)" : "var(--line)",
              }}
            >
              {pt}
            </button>
          ))}
        </div>
      </PropsSection>

      {/* Section: Explanation */}
      <PropsSection label="Explanation" hint="Shown after answering">
        <textarea
          value={question.explanation || ""}
          onChange={(e) => onChange({ ...question, explanation: e.target.value })}
          placeholder="Why is this correct?"
          rows={3}
          style={{
            width: "100%", padding: "0.5rem 0.625rem", borderRadius: "var(--radius-md)",
            border: "1.5px solid var(--line)", background: "var(--surface)",
            fontSize: "0.8125rem", color: "var(--ink)", resize: "vertical",
            fontFamily: "inherit", outline: "none",
          }}
        />
      </PropsSection>

      {/* Section: Shuffle */}
      <PropsSection label="Answer Order">
        <button
          onClick={() => onChange({ ...question, shuffleAnswers: !question.shuffleAnswers })}
          style={{
            ...chipStyle,
            background: question.shuffleAnswers ? "var(--accent)" : "var(--bg-subtle)",
            color: question.shuffleAnswers ? "#fff" : "var(--muted)",
            borderColor: question.shuffleAnswers ? "var(--accent)" : "var(--line)",
          }}
        >
          {question.shuffleAnswers ? "🔀 Shuffle On" : "🔀 Shuffle Off"}
        </button>
      </PropsSection>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Section: Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", borderTop: "1px solid var(--line)", paddingTop: "0.75rem" }}>
        <button onClick={onAddQuestion} className="btn btn-sm btn-ghost" style={{ width: "100%", border: "1px solid var(--line)", justifyContent: "center" }}>
          + Multiple Choice
        </button>
        <button onClick={onAddTrueFalse} className="btn btn-sm btn-ghost" style={{ width: "100%", border: "1px solid var(--line)", justifyContent: "center" }}>
          + True/False
        </button>
        {onEnrich && questions.some((q) => q.text.trim() && !q.explanation?.trim()) && (
          <button
            onClick={onEnrich}
            disabled={enriching}
            className="btn btn-sm btn-ghost"
            style={{ width: "100%", border: "1px solid var(--accent)", color: "var(--accent)", justifyContent: "center", opacity: enriching ? 0.6 : 1 }}
          >
            {enriching ? "⏳ Adding…" : "✨ Add explanations"}
          </button>
        )}
      </div>

      {/* Section: Navigator */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderTop: "1px solid var(--line)", paddingTop: "0.75rem" }}>
        <button onClick={onPrevious} disabled={index === 0} className="btn btn-sm btn-secondary" style={{ flex: 1, justifyContent: "center", opacity: index === 0 ? 0.4 : 1 }}>
          ← Prev
        </button>
        <span data-testid="question-nav" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>
          {index + 1} / {total}
        </span>
        <button onClick={onNext} className="btn btn-sm btn-primary" style={{ flex: 1, justifyContent: "center" }}>
          {index < total - 1 ? "Next →" : "+ New"}
        </button>
      </div>
    </div>
  );
}

function PropsSection({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem", marginBottom: "0.375rem" }}>
        <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
        {hint && <span style={{ fontSize: "0.625rem", color: "var(--faint)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  padding: "0.375rem 0.625rem",
  borderRadius: "var(--radius-md)",
  border: "1.5px solid",
  fontSize: "0.75rem",
  fontWeight: 700,
  cursor: "pointer",
  transition: "all 0.15s",
  whiteSpace: "nowrap",
  display: "flex",
  alignItems: "center",
};

"use client";

import { BuilderToolbar } from "@/components/builder/BuilderToolbar";
import { Confetti } from "@/components/builder/Confetti";
import { LivePreview } from "@/components/builder/LivePreview";
import { PropertiesPanel } from "@/components/builder/PropertiesPanel";
import { QuestionCard, type QuestionData } from "@/components/builder/QuestionCard";
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

      <div className="builder-main-layout">
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
            <div className="builder-editor-card-wrap">
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
            <div className="builder-empty-editor">
              <p>Add a question to get started</p>
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
            <div className="builder-empty-properties">
              <p>Select a question to edit its properties</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: floating properties toggle */}
      {activeQuestion && (
        <button
          onClick={() => setShowMobileProps(!showMobileProps)}
          className="md:hidden builder-mobile-props-toggle"
          aria-label="Toggle properties"
        >
          ⚙️
        </button>
      )}

      {/* Mobile: properties drawer */}
      {showMobileProps && activeQuestion && (
        <div className="md:hidden builder-mobile-props-drawer">
          <div className="builder-mobile-props-header">
            <span>Question Properties</span>
            <button onClick={() => setShowMobileProps(false)} aria-label="Close properties">✕</button>
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

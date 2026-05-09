import { BuilderToolbar } from "@/components/builder/BuilderToolbar";
import { Confetti } from "@/components/builder/Confetti";
import { LivePreview } from "@/components/builder/LivePreview";
import { QuestionCard, type QuestionData } from "@/components/builder/QuestionCard";
import { QuestionSidebar } from "@/components/builder/QuestionSidebar";

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
}: BuilderWorkspaceProps) {
  const activeQuestion = questions[activeIndex] || null;

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

      <div className="flex-1 flex">
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

        <div className="md:hidden fixed bottom-4 left-4 z-40">
          <button onClick={onAddQuestion} className="btn btn-primary builder-mobile-add" aria-label="Add question">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto builder-editor-surface">
          {showPreview && activeQuestion && (
            <LivePreview question={activeQuestion} index={activeIndex} total={questions.length} onClose={onPreview} />
          )}

          {activeQuestion ? (
            <div className="max-w-3xl mx-auto builder-editor-card-wrap">
              <QuestionCard
                question={activeQuestion}
                index={activeIndex}
                total={questions.length}
                onChange={(question) => onUpdateQuestion(activeIndex, question)}
                onDelete={() => onDeleteQuestion(activeIndex)}
                onDuplicate={() => onDuplicateQuestion(activeIndex)}
              />

              <QuestionNavigator
                activeIndex={activeIndex}
                questionCount={questions.length}
                onPrevious={() => onSelectQuestion(Math.max(activeIndex - 1, 0))}
                onNext={() => activeIndex < questions.length - 1 ? onSelectQuestion(activeIndex + 1) : onAddQuestion()}
              />

              <div className="flex items-center gap-2 mt-2 justify-center">
                <button onClick={onAddQuestion} className="btn btn-sm btn-ghost" style={{ border: "1px solid var(--line)" }}>
                  + Multiple Choice
                </button>
                <button onClick={onAddTrueFalse} className="btn btn-sm btn-ghost" style={{ border: "1px solid var(--line)" }}>
                  + True/False
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[var(--muted)]">Add a question to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionNavigator({ activeIndex, questionCount, onPrevious, onNext }: { activeIndex: number; questionCount: number; onPrevious: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-between mt-3">
      <button onClick={onPrevious} disabled={activeIndex === 0} className="btn btn-secondary btn-sm disabled:opacity-40">
        ← Previous
      </button>
      <span className="text-xs font-bold text-[var(--muted)]">
        {activeIndex + 1} / {questionCount}
      </span>
      <button onClick={onNext} className="btn btn-primary btn-sm">
        {activeIndex < questionCount - 1 ? "Next →" : "+ Add Question"}
      </button>
    </div>
  );
}

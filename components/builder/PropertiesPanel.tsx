import type { ReactNode } from "react";
import type { QuestionData, QuestionType } from "@/components/builder/QuestionCard";

const TIME_OPTIONS = [10, 20, 30, 60];
const POINT_OPTIONS = [500, 1000, 2000];

type PropertiesPanelProps = {
  question: QuestionData;
  index: number;
  total: number;
  questions: QuestionData[];
  enriching?: boolean;
  onChange: (question: QuestionData) => void;
  onPrevious: () => void;
  onNext: () => void;
  onAddQuestion: () => void;
  onAddTrueFalse: () => void;
  onEnrich?: () => void;
};

export function PropertiesPanel({
  question,
  index,
  total,
  questions,
  enriching,
  onChange,
  onPrevious,
  onNext,
  onAddQuestion,
  onAddTrueFalse,
  onEnrich,
}: PropertiesPanelProps) {
  const setType = (type: QuestionType) => {
    if (type === "true_false") {
      onChange({
        ...question,
        type,
        answers: [
          { id: crypto.randomUUID?.() || Math.random().toString(36).slice(2), text: "True", isCorrect: true },
          { id: crypto.randomUUID?.() || Math.random().toString(36).slice(2), text: "False", isCorrect: false },
        ],
      });
      return;
    }

    if (type === "poll") {
      onChange({
        ...question,
        type,
        answers: question.answers.map((answer) => ({ ...answer, isCorrect: false })),
      });
      return;
    }

    onChange({ ...question, type });
  };

  return (
    <div className="builder-properties">
      <PropsSection label="Question Type">
        <div className="builder-chip-row builder-chip-row--wrap">
          {(["multiple_choice", "true_false", "poll"] as const).map((type) => (
            <ChipButton
              key={type}
              selected={question.type === type}
              onClick={() => setType(type)}
            >
              {type === "multiple_choice" ? "◉ MC" : type === "true_false" ? "⚖ T/F" : "📊 Poll"}
            </ChipButton>
          ))}
        </div>
      </PropsSection>

      <PropsSection label="Time Limit">
        <div className="builder-chip-row">
          {TIME_OPTIONS.map((timeLimit) => (
            <ChipButton
              key={timeLimit}
              selected={question.timeLimit === timeLimit}
              onClick={() => onChange({ ...question, timeLimit })}
              className="builder-chip--fill"
            >
              {timeLimit}s
            </ChipButton>
          ))}
        </div>
      </PropsSection>

      <PropsSection label="Points">
        <div className="builder-chip-row">
          {POINT_OPTIONS.map((points) => (
            <ChipButton
              key={points}
              selected={question.points === points}
              onClick={() => onChange({ ...question, points })}
              className="builder-chip--fill"
            >
              {points}
            </ChipButton>
          ))}
        </div>
      </PropsSection>

      <PropsSection label="Explanation" hint="Shown after answering">
        <textarea
          value={question.explanation || ""}
          onChange={(event) => onChange({ ...question, explanation: event.target.value })}
          placeholder="Why is this correct?"
          rows={3}
          className="builder-properties-textarea"
        />
      </PropsSection>

      <PropsSection label="Answer Order">
        <ChipButton
          selected={Boolean(question.shuffleAnswers)}
          muted={!question.shuffleAnswers}
          onClick={() => onChange({ ...question, shuffleAnswers: !question.shuffleAnswers })}
        >
          {question.shuffleAnswers ? "🔀 Shuffle On" : "🔀 Shuffle Off"}
        </ChipButton>
      </PropsSection>

      <div className="builder-properties-spacer" />

      <div className="builder-properties-actions">
        <button onClick={onAddQuestion} className="btn btn-sm btn-ghost builder-panel-button">
          + Multiple Choice
        </button>
        <button onClick={onAddTrueFalse} className="btn btn-sm btn-ghost builder-panel-button">
          + True/False
        </button>
        {onEnrich && questions.some((candidate) => candidate.text.trim() && !candidate.explanation?.trim()) && (
          <button
            onClick={onEnrich}
            disabled={enriching}
            className="btn btn-sm btn-ghost builder-panel-button builder-panel-button--accent"
          >
            {enriching ? "⏳ Adding..." : "✨ Add explanations"}
          </button>
        )}
      </div>

      <div className="builder-properties-nav">
        <button
          onClick={onPrevious}
          disabled={index === 0}
          className="btn btn-sm btn-secondary builder-properties-nav-btn"
        >
          ← Prev
        </button>
        <span data-testid="question-nav" className="builder-properties-nav-count">
          {index + 1} / {total}
        </span>
        <button onClick={onNext} className="btn btn-sm btn-primary builder-properties-nav-btn">
          {index < total - 1 ? "Next →" : "+ New"}
        </button>
      </div>
    </div>
  );
}

function PropsSection({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="builder-properties-section-title">
        <span className="builder-properties-label">{label}</span>
        {hint && <span className="builder-properties-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ChipButton({
  selected,
  muted,
  className = "",
  children,
  onClick,
}: {
  selected: boolean;
  muted?: boolean;
  className?: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "builder-chip",
        selected ? "is-selected" : "",
        muted ? "is-muted" : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}

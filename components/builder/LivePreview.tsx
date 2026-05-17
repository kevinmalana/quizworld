"use client";

import type { QuestionData } from "./QuestionCard";

interface Props {
  question: QuestionData;
  index: number;
  total: number;
  onClose: () => void;
}

const ANSWER_COLORS = [
  { bg: "#eff6ff", border: "#bfdbfe", solid: "#1d4ed8" },
  { bg: "#f5f3ff", border: "#ddd6fe", solid: "#6d28d9" },
  { bg: "#ecfeff", border: "#a5f3fc", solid: "#0f766e" },
  { bg: "#fff7ed", border: "#fdba74", solid: "#c2410c" },
];

export function LivePreview({ question, index, total, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-dark" onClick={onClose}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>

        <div className="preview-header">
          <div className="preview-header-row">
            <span className="preview-label">PREVIEW · Question {index + 1} of {total}</span>
            <button onClick={onClose} className="preview-close-btn">✕</button>
          </div>
          {question.imageUrl && (
            <img src={question.imageUrl} alt="" className="preview-image" />
          )}
          <div className="preview-question-text">
            {question.text || "Your question will appear here"}
          </div>
        </div>

        <div className="preview-answers">
          {question.answers.map((answer, idx) => {
            const c = ANSWER_COLORS[idx] ?? ANSWER_COLORS[0];
            return (
              <div
                key={answer.id}
                className="preview-answer"
                style={{ background: c.bg, border: `2px solid ${c.border}` }}
              >
                <div className="preview-answer-badge" style={{ background: c.solid }}>
                  {String.fromCharCode(65 + idx)}
                </div>
                {answer.imageUrl && (
                  <img src={answer.imageUrl} alt="" className="preview-answer-img" />
                )}
                <span className="preview-answer-text">{answer.text || "..."}</span>
              </div>
            );
          })}
        </div>

        <div className="preview-footer">
          <div className="preview-footer-meta">
            <span>⏱ {question.timeLimit}s</span>
            <span>⭐ {question.points}pts</span>
          </div>
          <div className="preview-timer-track">
            <div className="preview-timer-fill" />
          </div>
        </div>

      </div>
    </div>
  );
}

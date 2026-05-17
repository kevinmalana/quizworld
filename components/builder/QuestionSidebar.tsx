"use client";

import { useState } from "react";
import type { QuestionData } from "./QuestionCard";

interface Props {
  questions: QuestionData[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAdd: () => void;
  onDelete?: (index: number) => void;
  onDuplicate?: (index: number) => void;
}

function getStatus(q: QuestionData): "ready" | "error" | "empty" {
  if (!q.text.trim()) return "empty";
  const filled = q.answers.filter((a) => a.text.trim()).length;
  const correct = q.answers.filter((a) => a.isCorrect && a.text.trim()).length;
  if (filled < 2 || (q.type !== "poll" && correct !== 1)) return "error";
  return "ready";
}

export function QuestionSidebar({ questions, activeIndex, onSelect, onReorder, onAdd, onDelete, onDuplicate }: Props) {
  const readyCount = questions.filter((q) => getStatus(q) === "ready").length;
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function handleDragStart(e: React.DragEvent, idx: number) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIdx(idx);
  }

  function handleDrop(e: React.DragEvent, toIdx: number) {
    e.preventDefault();
    const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(fromIdx) && fromIdx !== toIdx) {
      onReorder(fromIdx, toIdx);
    }
    setDragIdx(null);
    setDropIdx(null);
  }

  function handleDragEnd() {
    setDragIdx(null);
    setDropIdx(null);
  }

  function toggleSelect(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === questions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(questions.map((_, i) => i)));
    }
  }

  function deleteSelected() {
    if (!onDelete) return;
    const sorted = [...selected].sort((a, b) => b - a);
    sorted.forEach((idx) => onDelete(idx));
    setSelected(new Set());
  }

  function duplicateSelected() {
    if (!onDuplicate) return;
    const sorted = [...selected].sort((a, b) => a - b);
    sorted.forEach((idx) => onDuplicate(idx));
    setSelected(new Set());
  }

  return (
    <div className="builder-question-sidebar">
      {/* Header */}
      <div className="builder-question-sidebar__header">
        <span className="tag tag-accent builder-question-sidebar__tag">{questions.length} Questions</span>
        <span className="tag tag-success builder-question-sidebar__tag">{readyCount} ready</span>
      </div>

      {/* Progress bar */}
      <div className="builder-question-sidebar__progress">
        <div className="builder-question-sidebar__progress-meta">
          <span>{readyCount}/{questions.length} complete</span>
          {questions.length > 0 && (
            <span className={readyCount === questions.length ? "is-complete" : ""}>
              {Math.round((readyCount / questions.length) * 100)}%
            </span>
          )}
        </div>
        <progress
          className={readyCount === questions.length ? "builder-question-sidebar__progress-bar is-complete" : "builder-question-sidebar__progress-bar"}
          value={readyCount}
          max={Math.max(questions.length, 1)}
        />
      </div>

      {/* Bulk operations bar */}
      {selected.size > 0 && (
        <div className="builder-question-sidebar__bulk">
          <span className="builder-question-sidebar__selected">{selected.size} selected</span>
          {onDelete && (
            <button onClick={deleteSelected} className="btn btn-sm btn-ghost builder-question-sidebar__mini-button builder-question-sidebar__mini-button--danger">🗑 Delete</button>
          )}
          {onDuplicate && (
            <button onClick={duplicateSelected} className="btn btn-sm btn-ghost builder-question-sidebar__mini-button">⧉ Copy</button>
          )}
          <button onClick={() => setSelected(new Set())} className="btn btn-sm btn-ghost builder-question-sidebar__mini-button">✕</button>
        </div>
      )}

      {/* List */}
      <div className="builder-question-sidebar__list">
        {questions.length === 0 ? (
          <div className="builder-question-sidebar__empty">
            <div className="builder-question-sidebar__empty-icon">📝</div>
            <p className="builder-question-sidebar__empty-title">No questions yet</p>
            <p className="builder-question-sidebar__empty-text">Click &quot;+ Add Question&quot; below to start building your quiz.</p>
          </div>
        ) : (
          questions.map((q, idx) => {
            const status = getStatus(q);
            const isActive = idx === activeIndex;
            const isDragging = idx === dragIdx;
            const isDropTarget = idx === dropIdx && dragIdx !== null && dragIdx !== idx;
            const isSelected = selected.has(idx);
            const rowClasses = [
              "builder-question-sidebar__item",
              isActive ? "is-active" : "",
              isSelected ? "is-selected" : "",
              isDragging ? "is-dragging" : "",
              isDropTarget ? "is-drop-target" : "",
            ].filter(Boolean).join(" ");
            const numberClasses = [
              "builder-question-sidebar__number",
              isActive ? "is-active" : "",
              `is-${status}`,
            ].join(" ");

            return (
              <div
                key={q.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                onClick={() => onSelect(idx)}
                className={rowClasses}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => { e.stopPropagation(); toggleSelect(idx); }}
                  onClick={(e) => e.stopPropagation()}
                  className="builder-question-sidebar__checkbox"
                />
                <div className={numberClasses}>
                  {idx + 1}
                </div>
                <div className="builder-question-sidebar__item-body">
                  <p className={isActive ? "builder-question-sidebar__item-title is-active" : "builder-question-sidebar__item-title"}>
                    {q.text || "Empty"}
                  </p>
                  <p className="builder-question-sidebar__item-meta">
                    <span>{q.type === "true_false" ? "T/F" : q.type === "poll" ? "Poll" : `${q.answers.length} answers`} · {q.timeLimit}s · {q.points}pts</span>
                    {q.explanation && <span title="Has explanation" className="builder-question-sidebar__explanation">📖</span>}
                  </p>
                </div>
                <div className={`builder-question-sidebar__status-dot is-${status}`} />
              </div>
            );
          })
        )}
      </div>

      {/* Add */}
      <div className="builder-question-sidebar__footer">
        <button onClick={onAdd} className="btn btn-sm btn-secondary builder-question-sidebar__add">+ Add Question</button>
        <button onClick={selectAll} className="btn btn-sm btn-ghost builder-question-sidebar__select-all" title="Select all">☑</button>
      </div>
    </div>
  );
}

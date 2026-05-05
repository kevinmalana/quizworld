"use client";

import { useState } from "react";

interface Props {
  title: string;
  category: string;
  emoji: string;
  isPublic: boolean;
  questionCount: number;
  readyCount: number;
  draftState: "idle" | "dirty" | "saving" | "saved" | "error";
  canPublish: boolean;
  onTitleChange: (title: string) => void;
  onCategoryChange: (category: string) => void;
  onEmojiChange: (emoji: string) => void;
  onPublicChange: (isPublic: boolean) => void;
  onSaveDraft: () => void;
  onPreview: () => void;
  onPublish: () => void;
  onBack: () => void;
  isEditing: boolean;
}

const CATEGORIES = [
  "Trivia", "Science & Nature", "History", "Geography", "Entertainment",
  "Sports", "Languages", "Art & Literature", "Music", "Movies",
  "Technology", "Math", "Programming", "Business", "General Knowledge",
];

const CATEGORY_EMOJIS: Record<string, string> = {
  "Trivia": "💡", "Science & Nature": "🔬", "History": "📜", "Geography": "🌍",
  "Entertainment": "🎬", "Sports": "⚽", "Languages": "💬", "Art & Literature": "🎨",
  "Music": "🎵", "Movies": "🎬", "Technology": "💻", "Math": "🔢",
  "Programming": "🧑‍💻", "Business": "💼", "General Knowledge": "🧠",
};

export function BuilderToolbar({
  title, category, emoji, isPublic, questionCount, readyCount, draftState, canPublish,
  onTitleChange, onCategoryChange, onEmojiChange, onPublicChange,
  onSaveDraft, onPreview, onPublish, onBack, isEditing,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const draftLabel = draftState === "saving" ? "Saving…" : draftState === "saved" ? "Saved ✓" : draftState === "error" ? "Save failed" : "";

  return (
    <div className="sticky top-0 z-30 border-b" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        {/* Left: back + title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:bg-[var(--bg)] transition-colors"
            title="Back to source"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Title (editable) */}
          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
              className="font-display font-bold text-lg text-[var(--ink)] bg-transparent outline-none border-b-2 min-w-0 flex-1"
              style={{ borderColor: "var(--accent)" }}
              placeholder="Quiz title…"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="font-display font-bold text-lg text-[var(--ink)] truncate min-w-0 text-left hover:opacity-70 transition-opacity"
            >
              {title || "Untitled Quiz"}
              <span className="ml-1.5 text-[var(--muted)] text-xs">✎</span>
            </button>
          )}

          {/* Draft state */}
          {draftLabel && (
            <span className="text-xs font-semibold text-[var(--muted)] flex-shrink-0">{draftLabel}</span>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Settings popover */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:bg-[var(--bg)] transition-colors"
              title="Quiz settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" /><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83" />
              </svg>
            </button>

            {showSettings && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                <div
                  className="absolute right-0 top-10 z-50 w-72 rounded-2xl p-4 space-y-4"
                  style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "0 16px 48px rgba(0,0,0,0.12)" }}
                >
                  {/* Category */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1.5 block">Category</label>
                    <select
                      value={category}
                      onChange={(e) => { onCategoryChange(e.target.value); onEmojiChange(CATEGORY_EMOJIS[e.target.value] || "💡"); }}
                      className="w-full px-3 py-2 rounded-xl text-sm font-semibold text-[var(--ink)] outline-none"
                      style={{ border: "1px solid var(--line)", background: "var(--bg)" }}
                    >
                      {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_EMOJIS[c] || "💡"} {c}</option>)}
                    </select>
                  </div>

                  {/* Visibility */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--ink)]">Public quiz</span>
                    <button
                      onClick={() => onPublicChange(!isPublic)}
                      className="w-10 h-6 rounded-full transition-all relative"
                      style={{ background: isPublic ? "var(--accent)" : "var(--line)" }}
                    >
                      <div
                        className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                        style={{ left: isPublic ? 22 : 4 }}
                      />
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "var(--line)" }}>
                    <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background: "var(--success-light)" }}>
                      <div className="font-display font-black text-lg" style={{ color: "var(--success)" }}>{readyCount}</div>
                      <div className="text-[10px] font-bold" style={{ color: "var(--success)" }}>Ready</div>
                    </div>
                    <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background: "var(--primary-light)" }}>
                      <div className="font-display font-black text-lg" style={{ color: "var(--primary)" }}>{questionCount - readyCount}</div>
                      <div className="text-[10px] font-bold" style={{ color: "var(--primary)" }}>To Fix</div>
                    </div>
                    <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background: "var(--secondary-light)" }}>
                      <div className="font-display font-black text-lg" style={{ color: "var(--secondary)" }}>{questionCount}</div>
                      <div className="text-[10px] font-bold" style={{ color: "var(--secondary)" }}>Total</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Save draft */}
          <button
            onClick={onSaveDraft}
            disabled={draftState === "saving"}
            className="btn btn-secondary btn-sm"
          >
            {draftState === "saving" ? "Saving…" : "Save Draft"}
          </button>

          {/* Preview */}
          <button onClick={onPreview} className="btn btn-secondary btn-sm">
            Preview
          </button>

          {/* Publish */}
          <button
            onClick={onPublish}
            disabled={!canPublish}
            className="btn btn-primary btn-sm"
          >
            {isEditing ? "Update" : "Publish"} →
          </button>
        </div>
      </div>
    </div>
  );
}

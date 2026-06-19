"use client";

import { CATEGORY_EMOJIS } from "@/lib/shared";

const CATEGORIES = Object.keys(CATEGORY_EMOJIS);

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
  isSignedIn?: boolean;
}

export function BuilderToolbar({
  title, category, isPublic, questionCount, readyCount, draftState, canPublish,
  onTitleChange, onCategoryChange, onEmojiChange, onPublicChange,
  onSaveDraft, onPreview, onPublish, onBack, isEditing, isSignedIn,
}: Props) {
  const draftLabel = draftState === "saving" ? "Saving…" : draftState === "saved" ? "Saved ✓" : draftState === "error" ? "Failed" : "";

  return (
    <div className="builder-toolbar">
      <div className="builder-toolbar__inner">
        {/* Back button */}
        <button onClick={onBack} className="builder-toolbar__back" aria-label="Back to source options">←</button>

        {/* Title input */}
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Quiz title…"
          className="builder-toolbar__title"
        />

        {/* Draft label */}
        {draftLabel && (
          <span className={draftState === "saved" ? "builder-toolbar__draft is-saved" : "builder-toolbar__draft"}>
            {draftLabel}
          </span>
        )}

        {/* Spacer */}
        <div className="builder-toolbar__spacer" />

        {/* Public/Private toggle */}
        <button
          onClick={() => onPublicChange(!isPublic)}
          className={isPublic ? "builder-toolbar__visibility is-public" : "builder-toolbar__visibility"}
        >
          {isPublic ? "🌐 Public" : "🔒 Private"}
        </button>

        {/* Category */}
        <select
          value={category}
          onChange={(e) => { onCategoryChange(e.target.value); onEmojiChange(CATEGORY_EMOJIS[e.target.value] || "💡"); }}
          className="builder-toolbar__category"
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_EMOJIS[c] || "💡"} {c}</option>)}
        </select>

        {/* Actions */}
        <button onClick={onSaveDraft} className="builder-toolbar__button">Save</button>
        <button onClick={onPreview} className="builder-toolbar__button">Preview</button>

        {/* Hints */}
        {!canPublish && !title.trim() && (
          <span className="builder-toolbar__hint builder-toolbar__hint--primary">Add title</span>
        )}
        {!canPublish && title.trim() && readyCount < questionCount && (
          <span className="builder-toolbar__hint">Complete Qs</span>
        )}
        {!isSignedIn && canPublish && (
          <span className="builder-toolbar__hint builder-toolbar__hint--accent">🔐 Sign in</span>
        )}

        {/* Publish */}
        <button onClick={onPublish} disabled={!canPublish} className="builder-toolbar__publish">{isEditing ? "Update" : "Publish"} →</button>
      </div>
    </div>
  );
}

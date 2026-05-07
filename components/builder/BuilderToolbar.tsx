"use client";

import { useState } from "react";
import { CATEGORY_EMOJIS } from "@/lib/store";

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
  const [showSettings, setShowSettings] = useState(false);

  const draftLabel = draftState === "saving" ? "Saving…" : draftState === "saved" ? "Saved ✓" : draftState === "error" ? "Failed" : "";

  return (
    <div className="nav-header" style={{ position: "sticky", top: 0, zIndex: 30 }}>
      {/* Row 1: Back + Title + Draft label */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem 0", maxWidth: 1200, margin: "0 auto" }}>
        <button onClick={onBack} className="btn btn-sm btn-ghost" style={{ padding: "0.5rem", minWidth: 36, minHeight: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>←</button>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Quiz title…"
          className="input"
          style={{ fontWeight: 700, fontSize: "0.875rem", padding: "0.35rem 0.65rem", flex: 1, minWidth: 0, fontFamily: "var(--font-display)", border: "1.5px solid var(--line)", borderRadius: "var(--radius-lg)" }}
        />
        {draftLabel && <span className="tag" style={{ fontSize: "0.6rem", background: draftState === "saved" ? "var(--success-light)" : "var(--bg-subtle)", color: draftState === "saved" ? "var(--success)" : "var(--muted)", flexShrink: 0 }}>{draftLabel}</span>}
      </div>

      {/* Row 2: Category + Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 1rem 0.5rem", maxWidth: 1200, margin: "0 auto", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <select
          value={category}
          onChange={(e) => { onCategoryChange(e.target.value); onEmojiChange(CATEGORY_EMOJIS[e.target.value] || "💡"); }}
          style={{
            padding: "0.35rem 0.4rem",
            borderRadius: "var(--radius-lg)",
            border: "1.5px solid var(--line)",
            background: "var(--surface)",
            fontSize: "0.7rem",
            fontWeight: 700,
            color: "var(--ink)",
            cursor: "pointer",
            minHeight: 34,
            maxWidth: 140,
            flexShrink: 0,
          }}
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_EMOJIS[c] || "💡"} {c}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginLeft: "auto", flexShrink: 0 }}>
          <button onClick={onSaveDraft} className="btn btn-sm btn-secondary" style={{ minHeight: 34, padding: "0.35rem 0.6rem", fontSize: "0.75rem" }}>Save</button>
          <button onClick={onPreview} className="btn btn-sm btn-secondary" style={{ minHeight: 34, padding: "0.35rem 0.6rem", fontSize: "0.75rem" }}>Preview</button>
        </div>
        {!canPublish && !title.trim() && (
          <span style={{ fontSize: "0.6rem", color: "var(--primary)", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>Add a title</span>
        )}
        {!canPublish && title.trim() && readyCount < questionCount && (
          <span style={{ fontSize: "0.6rem", color: "var(--muted)", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>Complete all questions</span>
        )}
        {!isSignedIn && canPublish && (
          <span style={{ fontSize: "0.65rem", color: "var(--accent)", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>🔐 Sign in to publish</span>
        )}
        <button onClick={onPublish} disabled={!canPublish} className="btn btn-sm btn-primary" style={{ minHeight: 34, padding: "0.35rem 0.75rem", fontSize: "0.75rem", flexShrink: 0 }}>{isEditing ? "Update" : "Publish"} →</button>
      </div>
    </div>
  );
}

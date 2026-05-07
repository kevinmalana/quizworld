"use client";

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
  const draftLabel = draftState === "saving" ? "Saving…" : draftState === "saved" ? "Saved ✓" : draftState === "error" ? "Failed" : "";

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--surface)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.375rem", padding: "0.5rem 0.75rem", maxWidth: 1200, margin: "0 auto" }}>
        {/* Back button */}
        <button onClick={onBack} style={{ padding: "0.5rem", minWidth: 36, minHeight: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "none", border: "none", cursor: "pointer", fontSize: "1.125rem" }}>←</button>

        {/* Title input */}
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Quiz title…"
          style={{ fontWeight: 700, fontSize: "0.8125rem", padding: "0.35rem 0.65rem", width: 180, minWidth: 100, fontFamily: "var(--font-display)", border: "1.5px solid var(--line)", borderRadius: "var(--radius-lg)", background: "var(--surface)", color: "var(--ink)", outline: "none" }}
        />

        {/* Draft label */}
        {draftLabel && <span style={{ fontSize: "0.55rem", padding: "0.15rem 0.4rem", borderRadius: "999px", background: draftState === "saved" ? "var(--success-light)" : "var(--bg-subtle)", color: draftState === "saved" ? "var(--success)" : "var(--muted)", fontWeight: 700, flexShrink: 0 }}>{draftLabel}</span>}

        {/* Spacer */}
        <div style={{ flex: "1 1 0", minWidth: 8 }} />

        {/* Public/Private toggle */}
        <button
          onClick={() => onPublicChange(!isPublic)}
          style={{
            minHeight: 34, padding: "0.3rem 0.5rem", fontSize: "0.7rem", fontWeight: 700,
            borderRadius: "var(--radius-lg)", border: "1.5px solid " + (isPublic ? "var(--accent)" : "var(--line)"),
            background: isPublic ? "var(--accent-light)" : "var(--surface)",
            color: isPublic ? "var(--accent)" : "var(--muted)",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          {isPublic ? "🌐 Public" : "🔒 Private"}
        </button>

        {/* Category */}
        <select
          value={category}
          onChange={(e) => { onCategoryChange(e.target.value); onEmojiChange(CATEGORY_EMOJIS[e.target.value] || "💡"); }}
          style={{ padding: "0.3rem 0.5rem", borderRadius: "var(--radius-full)", border: "1.5px solid var(--line)", background: "var(--surface)", fontSize: "0.7rem", fontWeight: 700, color: "var(--ink)", cursor: "pointer", minHeight: 34, maxWidth: 160, flexShrink: 0 }}
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_EMOJIS[c] || "💡"} {c}</option>)}
        </select>

        {/* Actions */}
        <button onClick={onSaveDraft} style={{ minHeight: 34, padding: "0.3rem 0.6rem", fontSize: "0.75rem", fontWeight: 600, borderRadius: "var(--radius-full)", border: "1.5px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", flexShrink: 0 }}>Save</button>
        <button onClick={onPreview} style={{ minHeight: 34, padding: "0.3rem 0.6rem", fontSize: "0.75rem", fontWeight: 600, borderRadius: "var(--radius-full)", border: "1.5px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", flexShrink: 0 }}>Preview</button>

        {/* Hints */}
        {!canPublish && !title.trim() && (
          <span style={{ fontSize: "0.55rem", color: "var(--primary)", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>Add title</span>
        )}
        {!canPublish && title.trim() && readyCount < questionCount && (
          <span style={{ fontSize: "0.55rem", color: "var(--muted)", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>Complete Qs</span>
        )}
        {!isSignedIn && canPublish && (
          <span style={{ fontSize: "0.6rem", color: "var(--accent)", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>🔐 Sign in</span>
        )}

        {/* Publish */}
        <button onClick={onPublish} disabled={!canPublish} style={{ minHeight: 34, padding: "0.3rem 0.75rem", fontSize: "0.75rem", fontWeight: 700, borderRadius: "var(--radius-full)", border: "none", background: canPublish ? "var(--accent)" : "var(--line)", color: canPublish ? "#fff" : "var(--muted)", cursor: canPublish ? "pointer" : "default", flexShrink: 0, opacity: canPublish ? 1 : 0.6 }}>{isEditing ? "Update" : "Publish"} →</button>
      </div>
    </div>
  );
}

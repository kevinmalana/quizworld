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
  isSignedIn?: boolean;
}

const CATEGORIES = [
  "General Knowledge", "Trivia", "Education",
  "Science & Nature", "Space & Astronomy", "Technology", "Math", "Programming",
  "History", "Geography", "Politics & Government", "Current Events",
  "Entertainment", "Movies", "TV Shows", "Music", "Pop Culture", "Celebrities", "Comics & Anime",
  "Sports", "Video Games", "Travel & Tourism",
  "Art & Literature", "Photography", "Fashion & Style",
  "Food & Drink", "Health & Medicine", "Animals & Pets", "Nature & Environment",
  "Psychology & Mind", "Mythology & Folklore", "Religion & Spirituality",
  "Languages", "Business", "Social Media & Internet", "DIY & Crafts",
  "Cars & Automotive", "Relationships & Dating", "Holidays & Celebrations",
  "Inventions & Discoveries",
  "Other",
];
const CATEGORY_EMOJIS: Record<string, string> = { "Trivia": "💡", "Science & Nature": "🔬", "History": "📜", "Geography": "🌍", "Entertainment": "🎬", "Sports": "⚽", "Languages": "💬", "Art & Literature": "🎨", "Music": "🎵", "Movies": "🎬", "Technology": "💻", "Math": "🔢", "Programming": "🧑‍💻", "Business": "💼", "General Knowledge": "🧠" };

export function BuilderToolbar({
  title, category, isPublic, questionCount, readyCount, draftState, canPublish,
  onTitleChange, onCategoryChange, onEmojiChange, onPublicChange,
  onSaveDraft, onPreview, onPublish, onBack, isEditing, isSignedIn,
}: Props) {
  const [showSettings, setShowSettings] = useState(false);

  const draftLabel = draftState === "saving" ? "Saving…" : draftState === "saved" ? "Saved ✓" : draftState === "error" ? "Failed" : "";

  return (
    <div className="nav-header" style={{ position: "sticky", top: 0, zIndex: 30 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "0 1.25rem", height: "var(--nav-height)", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0, flex: 1 }}>
          <button onClick={onBack} className="btn btn-sm btn-ghost" style={{ padding: "0.5rem 0.625rem", minWidth: 36, minHeight: 36, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Quiz title…"
            className="input"
            style={{ fontWeight: 700, fontSize: "0.875rem", padding: "0.35rem 0.65rem", flex: 1, minWidth: 0, fontFamily: "var(--font-display)", border: "1.5px solid var(--line)", borderRadius: "var(--radius-lg)" }}
          />
          {draftLabel && <span className="tag" style={{ fontSize: "0.6rem", background: draftState === "saved" ? "var(--success-light)" : "var(--bg-subtle)", color: draftState === "saved" ? "var(--success)" : "var(--muted)" }}>{draftLabel}</span>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexShrink: 0 }}>
          {/* Category selector - always visible */}
          <select
            value={category}
            onChange={(e) => { onCategoryChange(e.target.value); onEmojiChange(CATEGORY_EMOJIS[e.target.value] || "💡"); }}
            style={{
              padding: "0.35rem 0.5rem",
              borderRadius: "var(--radius-lg)",
              border: "1.5px solid var(--line)",
              background: "var(--surface)",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--ink)",
              cursor: "pointer",
              minHeight: 36,
              maxWidth: 160,
            }}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_EMOJIS[c] || "💡"} {c}</option>)}
          </select>
          <button onClick={onSaveDraft} className="btn btn-sm btn-secondary" style={{ minHeight: 36 }}>Save</button>
          <button onClick={onPreview} className="btn btn-sm btn-secondary" style={{ minHeight: 36 }}>Preview</button>
          {!canPublish && !title.trim() && (
            <span style={{ fontSize: "0.6rem", color: "var(--primary)", fontWeight: 700, whiteSpace: "nowrap" }}>Add a title</span>
          )}
          {!canPublish && title.trim() && readyCount < questionCount && (
            <span style={{ fontSize: "0.6rem", color: "var(--muted)", fontWeight: 700, whiteSpace: "nowrap" }}>Complete all questions</span>
          )}
          {!isSignedIn && canPublish && (
            <span style={{ fontSize: "0.65rem", color: "var(--accent)", fontWeight: 700, whiteSpace: "nowrap" }}>🔐 Sign in to publish</span>
          )}
          <button onClick={onPublish} disabled={!canPublish} className="btn btn-sm btn-primary" style={{ minHeight: 36 }}>{isEditing ? "Update" : "Publish"} →</button>
        </div>
      </div>
    </div>
  );
}

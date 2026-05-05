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

const CATEGORIES = ["Trivia", "Science & Nature", "History", "Geography", "Entertainment", "Sports", "Languages", "Art & Literature", "Music", "Movies", "Technology", "Math", "Programming", "Business", "General Knowledge"];
const CATEGORY_EMOJIS: Record<string, string> = { "Trivia": "💡", "Science & Nature": "🔬", "History": "📜", "Geography": "🌍", "Entertainment": "🎬", "Sports": "⚽", "Languages": "💬", "Art & Literature": "🎨", "Music": "🎵", "Movies": "🎬", "Technology": "💻", "Math": "🔢", "Programming": "🧑‍💻", "Business": "💼", "General Knowledge": "🧠" };

export function BuilderToolbar({
  title, category, isPublic, questionCount, readyCount, draftState, canPublish,
  onTitleChange, onCategoryChange, onEmojiChange, onPublicChange,
  onSaveDraft, onPreview, onPublish, onBack, isEditing,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const draftLabel = draftState === "saving" ? "Saving…" : draftState === "saved" ? "Saved ✓" : draftState === "error" ? "Failed" : "";

  return (
    <div className="nav-header" style={{ position: "sticky", top: 0, zIndex: 30 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "0 1.25rem", height: "var(--nav-height)", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0, flex: 1 }}>
          <button onClick={onBack} className="btn btn-sm btn-ghost" style={{ padding: "0.375rem" }}>←</button>
          {editingTitle ? (
            <input autoFocus value={title} onChange={(e) => onTitleChange(e.target.value)}
              onBlur={() => setEditingTitle(false)} onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
              className="input" style={{ fontWeight: 700, fontSize: "0.875rem", padding: "0.25rem 0.5rem", flex: 1, minWidth: 0, fontFamily: "var(--font-display)" }} />
          ) : (
            <button onClick={() => setEditingTitle(true)}
              style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--ink)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-display)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title || "Untitled Quiz"} <span style={{ color: "var(--faint)", fontSize: "0.625rem" }}>✎</span>
            </button>
          )}
          {draftLabel && <span className="tag" style={{ fontSize: "0.6rem", background: draftState === "saved" ? "var(--success-light)" : "var(--bg-subtle)", color: draftState === "saved" ? "var(--success)" : "var(--muted)" }}>{draftLabel}</span>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowSettings(!showSettings)} className="btn btn-sm btn-ghost" style={{ padding: "0.375rem" }}>⚙</button>
            {showSettings && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowSettings(false)} />
                <div className="card-elevated" style={{ position: "absolute", right: 0, top: "2.5rem", zIndex: 50, width: "16rem", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div>
                    <label style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>Category</label>
                    <select value={category} onChange={(e) => { onCategoryChange(e.target.value); onEmojiChange(CATEGORY_EMOJIS[e.target.value] || "💡"); }}
                      className="input" style={{ fontSize: "0.8125rem", padding: "0.5rem" }}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_EMOJIS[c] || "💡"} {c}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--ink)" }}>Public</span>
                    <button onClick={() => onPublicChange(!isPublic)} style={{ width: "2.25rem", height: "1.25rem", borderRadius: "var(--radius-full)", background: isPublic ? "var(--accent)" : "var(--line)", border: "none", cursor: "pointer", position: "relative", transition: "all 0.2s" }}>
                      <div style={{ position: "absolute", top: "0.125rem", width: "1rem", height: "1rem", borderRadius: "50%", background: "#fff", transition: "all 0.2s", left: isPublic ? "1.125rem" : "0.125rem" }} />
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: "0.375rem", paddingTop: "0.5rem", borderTop: "1px solid var(--line)" }}>
                    {[{ l: "Ready", v: readyCount, c: "var(--success)" }, { l: "Fix", v: questionCount - readyCount, c: "var(--primary)" }, { l: "Total", v: questionCount, c: "var(--accent)" }].map(({ l, v, c }) => (
                      <div key={l} className="card" style={{ flex: 1, padding: "0.5rem", textAlign: "center", borderRadius: "var(--radius-sm)", background: `color-mix(in srgb, ${c} 8%, transparent)` }}>
                        <div style={{ fontWeight: 800, fontSize: "1rem", color: c }}>{v}</div>
                        <div style={{ fontSize: "0.6rem", fontWeight: 700, color: c }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <button onClick={onSaveDraft} className="btn btn-sm btn-secondary">Save</button>
          <button onClick={onPreview} className="btn btn-sm btn-secondary">Preview</button>
          <button onClick={onPublish} disabled={!canPublish} className="btn btn-sm btn-primary">{isEditing ? "Update" : "Publish"} →</button>
        </div>
      </div>
    </div>
  );
}

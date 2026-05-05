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

  const draftLabel = draftState === "saving" ? "Saving…" : draftState === "saved" ? "Saved ✓" : draftState === "error" ? "Failed" : "";

  return (
    <div className="sticky top-0 z-30 border-b" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button onClick={onBack} className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[var(--muted)] hover:bg-[var(--bg)] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          {editingTitle ? (
            <input autoFocus value={title} onChange={(e) => onTitleChange(e.target.value)} onBlur={() => setEditingTitle(false)} onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
              className="font-display font-bold text-sm text-[var(--ink)] bg-transparent outline-none border-b-2 min-w-0 flex-1" style={{ borderColor: "var(--accent)" }} placeholder="Quiz title…" />
          ) : (
            <button onClick={() => setEditingTitle(true)} className="font-display font-bold text-sm text-[var(--ink)] truncate min-w-0 text-left hover:opacity-70 transition-opacity">
              {title || "Untitled Quiz"} <span className="text-[var(--muted)] text-[10px]">✎</span>
            </button>
          )}
          {draftLabel && <span className="text-[10px] font-semibold text-[var(--muted)]">{draftLabel}</span>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="relative">
            <button onClick={() => setShowSettings(!showSettings)} className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--muted)] hover:bg-[var(--bg)] transition-colors" title="Settings">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83" /></svg>
            </button>
            {showSettings && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                <div className="absolute right-0 top-9 z-50 w-64 rounded-xl p-3 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "0 12px 40px rgba(0,0,0,0.1)" }}>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] mb-1 block">Category</label>
                    <select value={category} onChange={(e) => { onCategoryChange(e.target.value); onEmojiChange(CATEGORY_EMOJIS[e.target.value] || "💡"); }}
                      className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold text-[var(--ink)] outline-none" style={{ border: "1px solid var(--line)", background: "var(--bg)" }}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_EMOJIS[c] || "💡"} {c}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--ink)]">Public</span>
                    <button onClick={() => onPublicChange(!isPublic)} className="w-9 h-5 rounded-full transition-all relative" style={{ background: isPublic ? "var(--accent)" : "var(--line)" }}>
                      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm" style={{ left: isPublic ? 18 : 2 }} />
                    </button>
                  </div>
                  <div className="flex gap-1.5 pt-2 border-t" style={{ borderColor: "var(--line)" }}>
                    {[{ l: "Ready", v: readyCount, c: "var(--success)" }, { l: "Fix", v: questionCount - readyCount, c: "var(--primary)" }, { l: "Total", v: questionCount, c: "var(--accent)" }].map(({ l, v, c }) => (
                      <div key={l} className="flex-1 rounded-lg p-2 text-center" style={{ background: c + "12" }}>
                        <div className="font-display font-black text-sm" style={{ color: c }}>{v}</div>
                        <div className="text-[9px] font-bold" style={{ color: c }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <button onClick={onSaveDraft} className="btn btn-secondary btn-sm">Save</button>
          <button onClick={onPreview} className="btn btn-secondary btn-sm">Preview</button>
          <button onClick={onPublish} disabled={!canPublish} className="btn btn-primary btn-sm">{isEditing ? "Update" : "Publish"} →</button>
        </div>
      </div>
    </div>
  );
}

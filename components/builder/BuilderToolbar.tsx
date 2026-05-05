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
    <div className="sticky top-0 z-30 border-b" style={{ background: "rgba(10,10,20,0.85)", borderColor: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
              className="font-bold text-lg text-white bg-transparent outline-none border-b-2 min-w-0 flex-1 pb-0.5"
              style={{ borderColor: "#6366f1" }}
              placeholder="Quiz title…"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="font-bold text-lg text-white truncate min-w-0 text-left hover:opacity-80 transition-opacity flex items-center gap-2"
            >
              {title || "Untitled Quiz"}
              <span className="text-[rgba(255,255,255,0.25)] text-xs">✎</span>
            </button>
          )}

          {draftLabel && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ color: draftState === "saved" ? "#10b981" : draftState === "error" ? "#ef4444" : "rgba(255,255,255,0.35)", background: draftState === "saved" ? "rgba(16,185,129,0.1)" : draftState === "error" ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)" }}>
              {draftLabel}
            </span>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Settings */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ color: showSettings ? "#818cf8" : "rgba(255,255,255,0.4)", background: showSettings ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" /><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83" />
              </svg>
            </button>

            {showSettings && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                <div
                  className="absolute right-0 top-11 z-50 w-72 rounded-2xl p-5 space-y-4"
                  style={{ background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
                >
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: "rgba(255,255,255,0.3)" }}>Category</label>
                    <select
                      value={category}
                      onChange={(e) => { onCategoryChange(e.target.value); onEmojiChange(CATEGORY_EMOJIS[e.target.value] || "💡"); }}
                      className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-white outline-none"
                      style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
                    >
                      {CATEGORIES.map((c) => <option key={c} value={c} style={{ background: "#1e1e2e" }}>{CATEGORY_EMOJIS[c] || "💡"} {c}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Public quiz</span>
                    <button
                      onClick={() => onPublicChange(!isPublic)}
                      className="w-11 h-6 rounded-full transition-all relative"
                      style={{ background: isPublic ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "rgba(255,255,255,0.1)" }}
                    >
                      <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-md" style={{ left: isPublic ? 24 : 4 }} />
                    </button>
                  </div>

                  <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    {[
                      { label: "Ready", value: readyCount, color: "#10b981", bg: "rgba(16,185,129,0.1)" },
                      { label: "Fix", value: questionCount - readyCount, color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
                      { label: "Total", value: questionCount, color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
                    ].map(({ label, value, color, bg }) => (
                      <div key={label} className="flex-1 rounded-xl p-2.5 text-center" style={{ background: bg }}>
                        <div className="font-black text-lg" style={{ color }}>{value}</div>
                        <div className="text-[10px] font-bold" style={{ color }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <button onClick={onSaveDraft} className="btn-dark btn-sm">Save Draft</button>
          <button onClick={onPreview} className="btn-dark btn-sm">Preview</button>
          <button
            onClick={onPublish}
            disabled={!canPublish}
            className="btn-primary-dark btn-sm"
          >
            {isEditing ? "Update" : "Publish"} →
          </button>
        </div>
      </div>
    </div>
  );
}

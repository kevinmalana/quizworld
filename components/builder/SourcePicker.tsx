"use client";

import { useState } from "react";

export type SourceType = "manual" | "paste" | "ai-topic" | "ai-url" | "ai-document";

interface Props {
  onSelect: (type: SourceType) => void;
}

const SOURCES = [
  { key: "manual" as const, icon: "✏️", title: "Start from Scratch", desc: "Build question by question.", color: "var(--accent)" },
  { key: "ai-topic" as const, icon: "💡", title: "AI from Topic", desc: "Describe a topic, get a draft.", color: "#f59e0b" },
  { key: "paste" as const, icon: "📋", title: "Paste Questions", desc: "Paste in any format.", color: "#2563eb" },
  { key: "ai-url" as const, icon: "🔗", title: "AI from URL", desc: "Extract questions from a link.", color: "#059669" },
  { key: "ai-document" as const, icon: "📄", title: "AI from Document", desc: "Upload or paste text.", color: "#e11d48" },
];

export function SourcePicker({ onSelect }: Props) {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3" style={{ background: "var(--accent-light)" }}>
            <span className="text-xs">✦</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--accent)]">Quiz Builder</span>
          </div>
          <h1 className="font-display text-3xl font-black text-[var(--ink)] mb-2">Create a new quiz</h1>
          <p className="text-[var(--muted)] text-sm">Choose how you want to start.</p>
        </div>
        <div className="space-y-2">
          {SOURCES.map((s) => (
            <button
              key={s.key}
              onClick={() => onSelect(s.key)}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-150 group"
              style={{ background: "var(--surface)", border: "1.5px solid var(--line)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.boxShadow = `0 4px 16px ${s.color}15`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: s.color + "12" }}>
                {s.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-sm text-[var(--ink)]">{s.title}</h3>
                <p className="text-xs text-[var(--muted)]">{s.desc}</p>
              </div>
              <svg className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

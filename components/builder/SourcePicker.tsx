"use client";

import { useState } from "react";

export type SourceType = "manual" | "paste" | "ai-topic" | "ai-url" | "ai-document";

interface Props {
  onSelect: (type: SourceType) => void;
}

const SOURCES = [
  {
    key: "manual" as const,
    icon: "✏️",
    title: "Start from Scratch",
    desc: "Build your quiz question by question with full control.",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
  },
  {
    key: "ai-topic" as const,
    icon: "💡",
    title: "AI from Topic",
    desc: "Describe a topic and AI generates a draft in seconds.",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
  },
  {
    key: "paste" as const,
    icon: "📋",
    title: "Paste Questions",
    desc: "Paste existing questions in any format and we'll parse them.",
    gradient: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
  },
  {
    key: "ai-url" as const,
    icon: "🔗",
    title: "AI from URL",
    desc: "Paste a link and AI extracts quiz questions from the content.",
    gradient: "linear-gradient(135deg, #059669 0%, #34d399 100%)",
  },
  {
    key: "ai-document" as const,
    icon: "📄",
    title: "AI from Document",
    desc: "Upload a file (TXT, MD, CSV, JSON) and AI generates questions.",
    gradient: "linear-gradient(135deg, #e11d48 0%, #fb7185 100%)",
  },
];

export function SourcePicker({ onSelect }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4" style={{ background: "var(--accent-light)" }}>
            <span className="text-sm">✦</span>
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">Quiz Builder</span>
          </div>
          <h1 className="font-display text-4xl font-black text-[var(--ink)] mb-3">
            Create a new quiz
          </h1>
          <p className="text-[var(--muted)] text-lg font-medium max-w-md mx-auto">
            Choose how you want to start — every path leads to the same editor.
          </p>
        </div>

        {/* Source cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOURCES.map((source) => (
            <button
              key={source.key}
              onClick={() => onSelect(source.key)}
              onMouseEnter={() => setHovered(source.key)}
              onMouseLeave={() => setHovered(null)}
              className="relative text-left p-5 rounded-2xl transition-all duration-200 overflow-hidden group"
              style={{
                background: "var(--surface)",
                border: hovered === source.key ? "1.5px solid var(--accent)" : "1.5px solid var(--line)",
                boxShadow: hovered === source.key ? "0 8px 32px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
                transform: hovered === source.key ? "translateY(-2px)" : "none",
              }}
            >
              {/* Gradient accent */}
              <div
                className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl transition-opacity"
                style={{ background: source.gradient, opacity: hovered === source.key ? 1 : 0.5 }}
              />

              <div className="flex items-start gap-4">
                <div className="text-3xl flex-shrink-0 mt-0.5">{source.icon}</div>
                <div>
                  <h3 className="font-display font-bold text-[var(--ink)] mb-1">{source.title}</h3>
                  <p className="text-sm text-[var(--muted)] leading-relaxed">{source.desc}</p>
                </div>
              </div>

              {/* Arrow */}
              <div
                className="absolute right-4 top-1/2 -translate-y-1/2 transition-all"
                style={{ opacity: hovered === source.key ? 1 : 0, transform: hovered === source.key ? "translateX(0) translateY(-50%)" : "translateX(-8px) translateY(-50%)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

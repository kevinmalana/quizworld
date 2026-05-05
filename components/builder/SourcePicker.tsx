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
    gradient: "linear-gradient(135deg, #6366f1, #4f46e5)",
    glow: "rgba(99,102,241,0.2)",
  },
  {
    key: "ai-topic" as const,
    icon: "💡",
    title: "AI from Topic",
    desc: "Describe a topic and AI generates a draft in seconds.",
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    glow: "rgba(245,158,11,0.2)",
  },
  {
    key: "paste" as const,
    icon: "📋",
    title: "Paste Questions",
    desc: "Paste existing questions in any format and we'll parse them.",
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    glow: "rgba(59,130,246,0.2)",
  },
  {
    key: "ai-url" as const,
    icon: "🔗",
    title: "AI from URL",
    desc: "Paste a link and AI extracts quiz questions from the content.",
    gradient: "linear-gradient(135deg, #10b981, #059669)",
    glow: "rgba(16,185,129,0.2)",
  },
  {
    key: "ai-document" as const,
    icon: "📄",
    title: "AI from Document",
    desc: "Upload a file or paste text and AI generates questions.",
    gradient: "linear-gradient(135deg, #ec4899, #db2777)",
    glow: "rgba(236,72,153,0.2)",
  },
];

export function SourcePicker({ onSelect }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6" style={{ background: "#0a0a14" }}>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-5" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <span className="text-sm">✦</span>
            <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "#818cf8" }}>Quiz Builder</span>
          </div>
          <h1 className="font-display text-5xl font-black text-white mb-4 tracking-tight">
            Create a new quiz
          </h1>
          <p className="text-lg font-medium max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
            Choose how you want to start — every path leads to the same editor.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOURCES.map((source) => {
            const isHovered = hovered === source.key;
            return (
              <button
                key={source.key}
                onClick={() => onSelect(source.key)}
                onMouseEnter={() => setHovered(source.key)}
                onMouseLeave={() => setHovered(null)}
                className="relative text-left p-5 rounded-2xl transition-all duration-300 overflow-hidden group"
                style={{
                  background: isHovered ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                  border: isHovered ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.06)",
                  boxShadow: isHovered ? `0 8px 40px ${source.glow}` : "none",
                  transform: isHovered ? "translateY(-3px)" : "none",
                }}
              >
                {/* Top gradient line */}
                <div
                  className="absolute top-0 left-0 right-0 h-0.5 transition-opacity duration-300"
                  style={{ background: source.gradient, opacity: isHovered ? 1 : 0.3 }}
                />

                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-all duration-300"
                    style={{
                      background: isHovered ? source.gradient : "rgba(255,255,255,0.04)",
                      boxShadow: isHovered ? `0 4px 20px ${source.glow}` : "none",
                    }}
                  >
                    {source.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-1">{source.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{source.desc}</p>
                  </div>
                </div>

                {/* Arrow */}
                <div
                  className="absolute right-5 top-1/2 -translate-y-1/2 transition-all duration-300"
                  style={{ opacity: isHovered ? 1 : 0, transform: isHovered ? "translateY(-50%) translateX(0)" : "translateY(-50%) translateX(-8px)" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

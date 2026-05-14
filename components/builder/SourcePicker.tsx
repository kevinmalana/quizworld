"use client";

import type { AIGenerationOptions } from "@/lib/quiz-ai";

export type SourceType = "manual" | "paste" | "ai-topic" | "ai-url" | "ai-document";

interface Props {
  onSelect: (type: SourceType) => void;
  onTemplateSelect?: (topic: string, options: AIGenerationOptions) => void;
}

const SOURCES = [
  { key: "manual" as const, icon: "✏️", title: "Start from Scratch", desc: "Build question by question." },
  { key: "ai-topic" as const, icon: "💡", title: "AI from Topic", desc: "Describe a topic, get a draft." },
  { key: "paste" as const, icon: "📋", title: "Paste Text", desc: "Paste notes, articles, or questions." },
  { key: "ai-url" as const, icon: "🔗", title: "AI from URL", desc: "Extract questions from a link." },
  { key: "ai-document" as const, icon: "📄", title: "AI from Document", desc: "Upload or paste text." },
];

const TEMPLATES = [
  {
    label: "🧠 Trivia Night",
    desc: "5 fun mixed trivia questions",
    topic: "General knowledge trivia covering science, history, geography, pop culture, and sports",
    options: { audience: "Adults at a trivia night", difficulty: "mixed" as const, questionTypes: { mc: true, tf: true }, focusAreas: "", tone: "fun" as const },
  },
  {
    label: "📚 Study Quiz",
    desc: "Test your knowledge",
    topic: "Educational quiz covering key concepts, definitions, and important facts",
    options: { audience: "Students", difficulty: "balanced" as const, questionTypes: { mc: true, tf: true }, focusAreas: "", tone: "educational" as const },
  },
  {
    label: "🎉 Party Game",
    desc: "Fun for everyone",
    topic: "Fun entertaining questions about movies, music, celebrities, and pop culture",
    options: { audience: "Everyone at a party", difficulty: "easy" as const, questionTypes: { mc: true, tf: true }, focusAreas: "", tone: "fun" as const },
  },
  {
    label: "💼 Team Building",
    desc: "Work-friendly quiz",
    topic: "Professional team building quiz about business, technology, and workplace fun",
    options: { audience: "Coworkers at a team event", difficulty: "easy" as const, questionTypes: { mc: true, tf: true }, focusAreas: "", tone: "fun" as const },
  },
];

export function SourcePicker({ onSelect, onTemplateSelect }: Props) {
  return (
    <div className="container" style={{ minHeight: "calc(100vh - var(--nav-height))", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem 1rem" }}>
      <div style={{ width: "100%", maxWidth: "36rem" }}>
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <div className="tag tag-accent" style={{ marginBottom: "0.75rem" }}>✦ Quiz Builder</div>
          <h1 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--ink)", marginBottom: "0.375rem" }}>Create a new quiz</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Choose how you want to start.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {SOURCES.map((s) => (
            <button key={s.key} onClick={() => onSelect(s.key)}
              className="card card-hover"
              style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem", textAlign: "left", cursor: "pointer", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)" }}>
              <div style={{ width: "2.5rem", height: "2.5rem", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", background: "var(--accent-light)", flexShrink: 0 }}>
                {s.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--ink)", fontFamily: "var(--font-display)" }}>{s.title}</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{s.desc}</p>
              </div>
              <span style={{ color: "var(--faint)", fontSize: "0.875rem" }}>→</span>
            </button>
          ))}
        </div>

        {/* Quick start templates with presets */}
        <div style={{ marginTop: "1.25rem" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick start templates</p>
          <div style={{ display: "grid", gap: "0.375rem", gridTemplateColumns: "repeat(2, 1fr)" }}>
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => {
                  if (onTemplateSelect) {
                    onTemplateSelect(t.topic, t.options);
                  } else {
                    onSelect("ai-topic");
                  }
                }}
                className="card card-hover"
                style={{ padding: "0.75rem", textAlign: "left", cursor: "pointer", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)" }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: "var(--ink)", marginBottom: "0.125rem" }}>{t.label}</div>
                <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

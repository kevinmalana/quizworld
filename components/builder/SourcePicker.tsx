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
    <div className="container builder-source-picker">
      <div className="builder-source-picker__panel">
        <div className="builder-source-picker__header">
          <div className="tag tag-accent builder-source-picker__tag">✦ Quiz Builder</div>
          <h1 className="font-display builder-source-picker__title">Create a new quiz</h1>
          <p className="builder-source-picker__subtitle">Choose how you want to start.</p>
        </div>

        <div className="builder-source-picker__list">
          {SOURCES.map((s) => (
            <button key={s.key} onClick={() => onSelect(s.key)}
              className="card card-hover builder-source-option">
              <div className="builder-source-option__icon">
                {s.icon}
              </div>
              <div className="builder-source-option__body">
                <h3 className="builder-source-option__title">{s.title}</h3>
                <p className="builder-source-option__desc">{s.desc}</p>
              </div>
              <span className="builder-source-option__arrow">→</span>
            </button>
          ))}
        </div>

        {/* Quick start templates with presets */}
        <div className="builder-source-templates">
          <p className="builder-source-templates__label">Quick start templates</p>
          <div className="builder-source-templates__grid">
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
                className="card card-hover builder-source-template"
              >
                <div className="builder-source-template__title">{t.label}</div>
                <div className="builder-source-template__desc">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

export type SourceType = "manual" | "paste" | "ai-topic" | "ai-url" | "ai-document";

interface Props {
  onSelect: (type: SourceType) => void;
}

const SOURCES = [
  { key: "manual" as const, icon: "✏️", title: "Start from Scratch", desc: "Build question by question." },
  { key: "ai-topic" as const, icon: "💡", title: "AI from Topic", desc: "Describe a topic, get a draft." },
  { key: "paste" as const, icon: "📋", title: "Paste Questions", desc: "Paste in any format." },
  { key: "ai-url" as const, icon: "🔗", title: "AI from URL", desc: "Extract questions from a link." },
  { key: "ai-document" as const, icon: "📄", title: "AI from Document", desc: "Upload or paste text." },
];

export function SourcePicker({ onSelect }: Props) {
  return (
    <div className="container" style={{ minHeight: "calc(100vh - var(--nav-height))", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ width: "100%", maxWidth: "36rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div className="tag tag-accent" style={{ marginBottom: "0.75rem" }}>✦ Quiz Builder</div>
          <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 800, color: "var(--ink)", marginBottom: "0.5rem" }}>Create a new quiz</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Choose how you want to start.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {SOURCES.map((s) => (
            <button key={s.key} onClick={() => onSelect(s.key)}
              className="card card-hover"
              style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem", textAlign: "left", cursor: "pointer", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)" }}>
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
      </div>
    </div>
  );
}

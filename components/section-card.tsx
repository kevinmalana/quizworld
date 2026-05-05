import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section
      style={{
        background: "var(--surface)",
        borderRadius: 20,
        border: "1px solid var(--line)",
        padding: "1.5rem",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ marginBottom: "1.25rem" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "1.15rem",
            fontWeight: 800,
            color: "var(--ink)",
            letterSpacing: "-0.02em",
            fontFamily: "var(--font-display)",
          }}
        >
          {title}
        </h2>
        {description ? (
          <p
            style={{
              margin: "0.4rem 0 0",
              fontSize: "0.9rem",
              color: "var(--muted)",
              lineHeight: 1.6,
              maxWidth: "56ch",
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

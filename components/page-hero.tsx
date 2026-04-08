import type { ReactNode } from "react";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  accent?: string;
};

export function PageHero({ eyebrow, title, description, actions, accent }: PageHeroProps) {
  const background = accent
    ? accent.includes("gradient")
      ? accent
      : `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`
    : "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)";

  return (
    <section
      style={{
        background,
        borderRadius: 20,
        padding: "2rem",
        color: "#fff",
        marginBottom: "0.25rem",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "0.7rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          opacity: 0.75,
        }}
      >
        {eyebrow}
      </p>
      <h1
        style={{
          margin: "0.5rem 0 0",
          fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          maxWidth: "18ch",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          margin: "0.65rem 0 0",
          fontSize: "0.9rem",
          opacity: 0.8,
          lineHeight: 1.6,
          maxWidth: "52ch",
        }}
      >
        {description}
      </p>
      {actions ? (
        <div style={{ marginTop: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.625rem" }}>
          {actions}
        </div>
      ) : null}
    </section>
  );
}

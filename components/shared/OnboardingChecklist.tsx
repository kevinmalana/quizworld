"use client";

import Link from "next/link";

interface OnboardingChecklistProps {
  hasDisplayName: boolean;
  quizzesCreated: number;
  gamesPlayed: number;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  href: string;
  completed: boolean;
  emoji: string;
  iconColor: string;
}

export function OnboardingChecklist({
  hasDisplayName,
  quizzesCreated,
  gamesPlayed,
}: OnboardingChecklistProps) {
  const items: ChecklistItem[] = [
    {
      id: "profile",
      label: "Complete your profile",
      description: "Set your display name and avatar",
      href: "/profile",
      completed: hasDisplayName,
      emoji: "👤",
      iconColor: "#6366f1",
    },
    {
      id: "explore",
      label: "Explore quizzes",
      description: "Browse quizzes from the community",
      href: "/explore",
      completed: false,
      emoji: "🔍",
      iconColor: "#0ea5e9",
    },
    {
      id: "create",
      label: "Create your first quiz",
      description: "Build your first quiz in minutes",
      href: "/create",
      completed: quizzesCreated > 0,
      emoji: "✏️",
      iconColor: "#f59e0b",
    },
    {
      id: "play",
      label: "Play a live game",
      description: "Join a live multiplayer game",
      href: "/join",
      completed: gamesPlayed > 0,
      emoji: "🎮",
      iconColor: "#10b981",
    },
    {
      id: "study",
      label: "Study a topic",
      description: "Learn at your own pace with flashcards",
      href: "/study",
      completed: false,
      emoji: "📚",
      iconColor: "#8b5cf6",
    },
  ];

  const completedCount = items.filter((item) => item.completed).length;
  const progressPct = Math.round((completedCount / items.length) * 100);
  const allDone = completedCount === items.length;

  return (
    <div
      style={{
        width: "100%",
        borderRadius: "var(--radius-md, 1rem)",
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(124,58,237,0.12)",
        border: "1px solid var(--line)",
      }}
    >
      {/* Gradient header */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--accent), #a78bfa)",
          padding: "2rem 2rem 1.75rem",
          color: "#fff",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2.75rem", marginBottom: "0.5rem" }}>🚀</div>
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "#fff",
            margin: "0 0 0.375rem",
            letterSpacing: "-0.01em",
          }}
        >
          Welcome to QuizWorld!
        </h2>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.9375rem", margin: 0 }}>
          Complete these steps to get started
        </p>

        {/* Progress bar */}
        <div style={{ marginTop: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.8125rem",
              color: "rgba(255,255,255,0.9)",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            <span>{completedCount} of {items.length} complete</span>
            <span>{progressPct}%</span>
          </div>
          <div
            style={{
              height: 12,
              background: "rgba(255,255,255,0.25)",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "#fff",
                borderRadius: 999,
                transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Items list */}
      <div
        style={{
          background: "var(--surface)",
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.625rem",
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.875rem",
              padding: "0.875rem 1rem",
              background: item.completed ? "#f0fdf4" : "#fff",
              border: `1px solid ${item.completed ? "#bbf7d0" : "var(--line)"}`,
              borderRadius: "0.75rem",
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            {/* Icon circle */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: item.completed ? "#dcfce7" : `${item.iconColor}18`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.125rem",
                flexShrink: 0,
                border: `1.5px solid ${item.completed ? "#86efac" : `${item.iconColor}30`}`,
              }}
            >
              {item.emoji}
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.9375rem",
                  color: item.completed ? "#15803d" : "var(--ink)",
                  textDecoration: item.completed ? "line-through" : "none",
                  lineHeight: 1.3,
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: "0.8125rem",
                  color: item.completed ? "#86efac" : "var(--muted)",
                  marginTop: "0.125rem",
                }}
              >
                {item.description}
              </div>
            </div>

            {/* Right action */}
            {item.completed ? (
              <span
                style={{
                  background: "#22c55e",
                  color: "#fff",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "0.25rem 0.625rem",
                  borderRadius: 999,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                ✓ Done
              </span>
            ) : (
              <Link
                href={item.href}
                style={{
                  background: item.iconColor,
                  color: "#fff",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  padding: "0.375rem 0.875rem",
                  borderRadius: 999,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "opacity 0.15s",
                }}
              >
                Start →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div
        style={{
          background: "var(--surface)",
          padding: "0 1.25rem 1.5rem",
          textAlign: "center",
          borderTop: "1px solid var(--line)",
          paddingTop: "1.25rem",
        }}
      >
        {allDone ? (
          <Link href="/explore" className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
            🎉 You&apos;re all set! Keep exploring
          </Link>
        ) : (
          <Link href="/create" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
            ✨ Let&apos;s Go! Create your first quiz
          </Link>
        )}
      </div>
    </div>
  );
}

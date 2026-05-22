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
      description: "Add a display name & avatar",
      href: "/profile",
      completed: hasDisplayName,
      emoji: "👤",
      iconColor: "var(--accent)",
    },
    {
      id: "explore",
      label: "Explore quizzes",
      description: "Browse the community",
      href: "/explore",
      completed: false,
      emoji: "🔍",
      iconColor: "var(--secondary)",
    },
    {
      id: "create",
      label: "Create a quiz",
      description: "Build your first quiz",
      href: "/create",
      completed: quizzesCreated > 0,
      emoji: "✏️",
      iconColor: "var(--warning)",
    },
    {
      id: "play",
      label: "Play a live game",
      description: "Join a multiplayer session",
      href: "/join",
      completed: gamesPlayed > 0,
      emoji: "🎮",
      iconColor: "var(--success)",
    },
    {
      id: "study",
      label: "Study a topic",
      description: "Flashcards at your own pace",
      href: "/study",
      completed: false,
      emoji: "📚",
      iconColor: "var(--primary)",
    },
  ];

  const completedCount = items.filter((item) => item.completed).length;
  const progressPct = Math.round((completedCount / items.length) * 100);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
          <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--ink)" }}>
            🚀 Getting started
          </span>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)" }}>
            {completedCount}/{items.length}
          </span>
        </div>
        {/* Progress bar */}
        <div style={{ height: 6, background: "var(--line)", borderRadius: 999, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: "var(--accent)",
              borderRadius: 999,
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>

      {/* Items */}
      <div style={{ padding: "0.5rem 0" }}>
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.625rem 1.25rem",
              textDecoration: "none",
              color: "inherit",
              opacity: item.completed ? 0.6 : 1,
              transition: "background 0.1s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-subtle)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            {/* Icon */}
            <div style={{
              width: 32, height: 32, borderRadius: "var(--radius-sm)",
              background: item.completed ? "var(--bg-subtle)" : "var(--accent-light)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.9375rem", flexShrink: 0,
            }}>
              {item.completed ? "✅" : item.emoji}
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 600, fontSize: "0.875rem",
                color: item.completed ? "var(--muted)" : "var(--ink)",
                textDecoration: item.completed ? "line-through" : "none",
              }}>
                {item.label}
              </div>
              {!item.completed && (
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 1 }}>
                  {item.description}
                </div>
              )}
            </div>

            {/* Arrow */}
            {!item.completed && (
              <span style={{ fontSize: "0.8rem", color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>→</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

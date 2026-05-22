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
  href: string;
  completed: boolean;
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
      href: "/profile",
      completed: hasDisplayName,
    },
    {
      id: "explore",
      label: "Explore quizzes",
      href: "/explore",
      completed: false, // always actionable
    },
    {
      id: "create",
      label: "Create your first quiz",
      href: "/create",
      completed: quizzesCreated > 0,
    },
    {
      id: "play",
      label: "Play a live game",
      href: "/join",
      completed: gamesPlayed > 0,
    },
    {
      id: "study",
      label: "Study a topic",
      href: "/study",
      completed: false, // always actionable
    },
  ];

  const completedCount = items.filter((item) => item.completed).length;
  const progressPct = Math.round((completedCount / items.length) * 100);

  return (
    <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎉</div>
        <h2 className="font-display" style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>
          Welcome to QuizWorld!
        </h2>
        <p className="text-muted" style={{ fontSize: "0.9rem" }}>
          Here&apos;s how to get started
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.8rem",
            color: "var(--muted)",
            marginBottom: "0.4rem",
          }}
        >
          <span>{completedCount}/{items.length} steps complete</span>
          <span>{progressPct}%</span>
        </div>
        <div
          style={{
            height: 8,
            background: "var(--border)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: "var(--accent, #7c3aed)",
              borderRadius: 4,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              background: item.completed ? "var(--success-bg, #d1fae5)" : "var(--surface)",
              border: `1px solid ${item.completed ? "var(--success, #10b981)" : "var(--border)"}`,
              borderRadius: "0.5rem",
              textDecoration: "none",
              color: "inherit",
              transition: "background 0.15s",
            }}
          >
            <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>
              {item.completed ? "✅" : "☐"}
            </span>
            <span
              style={{
                flex: 1,
                fontSize: "0.9375rem",
                textDecoration: item.completed ? "line-through" : "none",
                color: item.completed ? "var(--muted)" : "inherit",
              }}
            >
              {item.label}
            </span>
            {!item.completed && (
              <span style={{ fontSize: "0.8rem", color: "var(--accent, #7c3aed)", fontWeight: 600 }}>
                Go →
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* CTA when empty */}
      <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <Link href="/create" className="btn btn-primary">
          ✨ Create Your First Quiz
        </Link>
      </div>
    </div>
  );
}

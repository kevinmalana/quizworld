"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_EMOJIS } from "@/lib/store";
import { GAME_PIN_LENGTH, isCompleteGamePin, sanitizeGamePinInput } from "@/lib/game-pin";

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "Art & Literature": "Books, art & culture",
  Entertainment: "Movies, music & more",
  Geography: "Explore the world",
  History: "Journey through time",
  Languages: "Master new tongues",
  "Science & Nature": "Discover & experiment",
  Sports: "Games & athletes",
  Trivia: "General knowledge challenges",
};

const categories = [
  "Geography",
  "Science & Nature",
  "History",
  "Entertainment",
  "Languages",
  "Art & Literature",
  "Sports",
  "Trivia",
].map((label) => ({
  label,
  emoji: CATEGORY_EMOJIS[label] || "📌",
  desc: CATEGORY_DESCRIPTIONS[label] || "Play quizzes on this topic",
}));



export default function HomePage() {
  const router = useRouter();
  const [pin, setPin] = useState("");

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedPin = sanitizeGamePinInput(pin);
    if (!isCompleteGamePin(sanitizedPin)) return;
    router.push(`/join?pin=${sanitizedPin}`);
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Background mesh */}
      <div className="mesh-gradient">
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />
      </div>

      {/* ── Hero ── */}
      <section style={{ padding: "5rem 0 4rem", position: "relative" }}>
        <div className="container">
          <div style={{ display: "grid", gap: "3rem", alignItems: "center", gridTemplateColumns: "1fr" }}>
            <style jsx>{`
              @media (min-width: 960px) {
                .hero-grid { grid-template-columns: 1.1fr 420px !important; gap: 4rem !important; }
              }
            `}</style>
            <div className="hero-grid" style={{ display: "grid", gap: "3rem", alignItems: "center" }}>
              {/* Left: Value prop */}
              <div className="animate-pop-in">
                <div className="tag tag-success" style={{ marginBottom: "1.5rem" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", display: "inline-block", marginRight: 6 }} />
                  Live Multiplayer
                </div>

                <h1
                  className="font-display"
                  style={{
                    fontSize: "clamp(2.5rem, 5vw, 3.75rem)",
                    fontWeight: 800,
                    lineHeight: 1.1,
                    letterSpacing: "-0.03em",
                    color: "var(--ink)",
                    marginBottom: "1.5rem",
                  }}
                >
                  Learning that feels like{" "}
                  <span className="text-gradient" style={{ display: "inline" }}>game night</span>
                </h1>

                <p
                  style={{
                    fontSize: "1.125rem",
                    color: "var(--ink-secondary)",
                    lineHeight: 1.7,
                    maxWidth: 520,
                    marginBottom: "2rem",
                  }}
                >
                  Create, share, and play engaging quizzes with friends, classmates, or the world.
                  Perfect for classrooms, team building, and trivia nights.
                </p>

                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "3rem" }}>
                  <Link href="/create" className="btn btn-primary btn-lg">
                    Create a Quiz
                  </Link>
                  <Link href="/explore" className="btn btn-secondary btn-lg">
                    Explore Library
                  </Link>
                </div>


              </div>

              {/* Right: Join Game Card */}
              <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
                <div
                  className="card-elevated"
                  style={{
                    padding: "2.5rem 2rem",
                    textAlign: "center",
                    background: "linear-gradient(135deg, rgba(124,58,237,0.04), rgba(37,99,235,0.04))",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🎮</div>
                  <h2
                    className="font-display"
                    style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--ink)", marginBottom: "0.25rem" }}
                  >
                    Ready to play?
                  </h2>
                  <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1.5rem" }}>
                    Enter the {GAME_PIN_LENGTH}-character game PIN to join instantly
                  </p>
                  <form onSubmit={handleJoin}>
                    <input
                      type="text"
                      inputMode="text"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="ABC123"
                      aria-label="6-character game PIN"
                      className="input-pin"
                      value={pin}
                      onChange={(e) => setPin(sanitizeGamePinInput(e.target.value))}
                      maxLength={GAME_PIN_LENGTH}
                      style={{ marginBottom: "1rem" }}
                    />
                    <button type="submit" className="btn btn-accent btn-lg" style={{ width: "100%" }} disabled={!isCompleteGamePin(pin)}>
                      Enter Game
                    </button>
                  </form>
                  <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--faint)", fontWeight: 600 }}>
                    No account needed · PINs are 6 letters/numbers
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Categories ── */}
      <section
        className="page-section"
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <h2
              className="font-display"
              style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em" }}
            >
              Pick a topic
            </h2>
            <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
              Thousands of quizzes across every subject
            </p>
          </div>

          <div className="grid-4">
            {categories.map((c) => (
              <Link
                key={c.label}
                href={`/explore?category=${c.label}`}
                className="card card-hover"
                style={{
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: "0.75rem",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "2.5rem" }}>{c.emoji}</span>
                <span
                  className="font-display"
                  style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--ink)" }}
                >
                  {c.label}
                </span>
                <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>{c.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="page-section" style={{ position: "relative", zIndex: 10 }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <h2
              className="font-display"
              style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em" }}
            >
              How it works
            </h2>
            <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
              From zero to quiz night in under 2 minutes
            </p>
          </div>

          <div className="grid-3">
            {[
              {
                step: "01",
                icon: "✨",
                title: "Create or Choose",
                desc: "Build a quiz from scratch, use AI generation, or pick from our library of thousands.",
              },
              {
                step: "02",
                icon: "📲",
                title: "Share the PIN",
                desc: "Launch a live session and share the game PIN. Players join from any device instantly.",
              },
              {
                step: "03",
                icon: "🏆",
                title: "Play & Learn",
                desc: "Answer questions in real-time, compete on the leaderboard, and track your progress.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="card"
                style={{ padding: "2rem 1.5rem", position: "relative" }}
              >
                <span
                  className="font-display"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    color: "var(--accent)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  Step {item.step}
                </span>
                <div style={{ fontSize: "2rem", margin: "0.75rem 0" }}>{item.icon}</div>
                <h3
                  className="font-display"
                  style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}
                >
                  {item.title}
                </h3>
                <p style={{ fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.6 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{ padding: "0 0 5rem", position: "relative", zIndex: 10 }}>
        <div className="container">
          <div
            style={{
              background: "linear-gradient(135deg, var(--accent), #6d28d9, #4f46e5)",
              borderRadius: "var(--radius-2xl)",
              padding: "3.5rem 2rem",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Subtle pattern overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.08,
                backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              <h2
                className="font-display"
                style={{
                  fontSize: "clamp(1.5rem, 3.5vw, 2.25rem)",
                  fontWeight: 800,
                  color: "#fff",
                  letterSpacing: "-0.02em",
                  marginBottom: "0.75rem",
                }}
              >
                Ready to make learning epic?
              </h2>
              <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.0625rem", marginBottom: "2rem", maxWidth: 500, margin: "0 auto 2rem" }}>
                Turn any lesson into a multiplayer game show in minutes. Free forever.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                <Link
                  href="/host"
                  className="btn btn-lg"
                  style={{
                    background: "#fff",
                    color: "var(--accent)",
                    fontWeight: 800,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                  }}
                >
                  Host a Game
                </Link>
                <Link
                  href="/create"
                  className="btn btn-lg"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    color: "#fff",
                    border: "1.5px solid rgba(255,255,255,0.3)",
                  }}
                >
                  Create a Quiz
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

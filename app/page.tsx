"use client";

import Link from "next/link";
import { useState } from "react";
import { CATEGORY_EMOJIS } from "@/lib/store";

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "General Knowledge": "Test your smarts",
  "Science & Nature": "Discover & experiment",
  "Space & Astronomy": "Stars, planets & beyond",
  Technology: "Gadgets & innovation",
  Math: "Numbers & logic",
  Programming: "Code challenges",
  History: "Journey through time",
  Geography: "Explore the world",
  "Politics & Government": "Laws & leaders",
  "Current Events": "What's happening now",
  Entertainment: "Movies, music & more",
  Movies: "Film trivia",
  "TV Shows": "Series & sitcoms",
  Music: "Songs & artists",
  "Pop Culture": "Trends, memes & viral moments",
  Celebrities: "Famous faces",
  "Comics & Anime": "Heroes & manga",
  Sports: "Games & athletes",
  "Video Games": "Gaming trivia",
  "Travel & Tourism": "World destinations",
  "Art & Literature": "Books, art & culture",
  Photography: "Captured moments",
  "Fashion & Style": "Trends & designers",
  "Food & Drink": "Cuisine & recipes",
  "Health & Medicine": "Body & wellness",
  "Animals & Pets": "Creatures great & small",
  "Animals": "Creatures great & small",
  "Nature & Environment": "Ecosystems & climate",
  "Psychology & Mind": "How we think",
  "Mythology & Folklore": "Legends & myths",
  "Religion & Spirituality": "Faith & belief",
  Languages: "Master new tongues",
  Business: "Markets & money",
  "Social Media & Internet": "Digital culture",
  "DIY & Crafts": "Make & create",
  "Cars & Automotive": "Engines & models",
  "Relationships & Dating": "Love & connection",
  "Holidays & Celebrations": "Festive trivia",
  "Inventions & Discoveries": "Breakthroughs & patents",
  Other: "Miscellaneous topics",
};

// Top 6 by actual quiz count in DB — keeps the homepage focused
const categories = [
  "General Knowledge",
  "Science & Nature",
  "History",
  "Geography",
  "Sports",
  "Music",
];

const categories_list = categories.map((label) => ({
  label,
  emoji: CATEGORY_EMOJIS[label] || "📌",
  desc: CATEGORY_DESCRIPTIONS[label] || "Play quizzes on this topic",
}));

const STEPS = [
  { step: "01", icon: "✨", title: "Create or Choose", desc: "Build a quiz from scratch, use AI generation, or pick from our library of thousands." },
  { step: "02", icon: "📲", title: "Share the PIN", desc: "Launch a live session and share the game PIN. Players join from any device instantly." },
  { step: "03", icon: "🏆", title: "Play & Learn", desc: "Answer questions in real-time, compete on the leaderboard, and track your progress." },
];

export default function HomePage() {
  const [pin, setPin] = useState("");

  // Presentation codes are purely alphabetic (e.g. ABCDEF).
  // Game PINs are purely numeric (e.g. 482910).
  // This prevents a numeric game PIN from ever being mistaken for a presentation code.
    // Always send to /join — the join page handles routing to presentation if needed.
  // We cannot reliably detect game PIN vs presentation code on the homepage
  // because both can be all-alpha (17% of game PINs are).
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = pin.trim();
    if (!trimmed) return;
    window.location.href = `/join?pin=${trimmed}`;
  };

  return (
    <div className="home-root">
      <div className="mesh-gradient">
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />
      </div>

      <section className="home-hero">
        <div className="container">
          <div className="home-hero-grid">
            <div className="animate-pop-in">
              <div className="tag tag-success mb-md">
                <span className="home-tag-dot" />
                Live Multiplayer
              </div>

              <h1 className="font-display home-hero-title">
                Learning that feels like{" "}
                <span className="text-gradient inline">game night</span>
              </h1>

              <p className="home-hero-desc">
                Create, share, and play engaging quizzes with friends, classmates, or the world.
                Perfect for classrooms, team building, and trivia nights.
              </p>

              <div className="home-hero-actions">
                <Link href="/create" className="btn btn-primary btn-lg">Create a Quiz</Link>
                <Link href="/explore" className="btn btn-secondary btn-lg">Explore Library</Link>
              </div>
            </div>

            <div className="animate-slide-up anim-delay-1">
              <div className="card-elevated home-join-card">
                <div className="home-join-icon">🎮</div>
                <h2 className="font-display home-join-title">Ready to join?</h2>
                <p className="home-join-subtitle">Enter a game PIN or presentation code</p>
                <form onSubmit={handleJoin}>
                  <input
                    type="text"
                    placeholder="Game PIN or Presentation Code"
                    className="input-pin mb-sm"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.toUpperCase())}
                    maxLength={8}
                  />
                  <button type="submit" className="btn btn-accent btn-lg btn-full">
                    Enter Game
                  </button>
                </form>
                <p className="home-join-hint">No account needed</p>
                <Link href="/present/join" className="home-join-present">🎤 Join a Presentation</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar removed — will add back once numbers are more impressive */}

      <section className="page-section home-section home-section-surface">
        <div className="container">
          <div className="home-section-header">
            <h2 className="font-display home-section-title">Pick a topic</h2>
            <p className="home-section-desc">Browse our most popular categories or <Link href="/explore" style={{ color: "var(--accent)" }}>explore all 28 topics →</Link></p>
          </div>

          <div className="grid-3">
            {categories_list.map((c) => (
              <Link key={c.label} href={`/explore?category=${c.label}`} className="card card-hover home-category-card">
                <span className="home-category-emoji">{c.emoji}</span>
                <span className="font-display home-category-name">{c.label}</span>
                <span className="home-category-desc">{c.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="page-section home-section">
        <div className="container">
          <div className="home-section-header">
            <h2 className="font-display home-section-title">How it works</h2>
            <p className="home-section-desc">From zero to quiz night in under 2 minutes</p>
          </div>

          <div className="grid-3">
            {STEPS.map((item) => (
              <div key={item.step} className="card home-step-card">
                <span className="font-display home-step-label">Step {item.step}</span>
                <div className="home-step-icon">{item.icon}</div>
                <h3 className="font-display home-step-title">{item.title}</h3>
                <p className="home-step-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-cta">
        <div className="container">
          <div className="home-cta-card">
            <div className="home-cta-pattern" />
            <div className="home-cta-content">
              <h2 className="font-display home-cta-title">Ready to make learning epic?</h2>
              <p className="home-cta-desc">Turn any topic into a live multiplayer quiz in minutes. Start playing today.</p>
              <div className="home-cta-actions">
                <Link href="/host" className="btn btn-lg home-cta-btn-primary">Host a Game</Link>
                <Link href="/create" className="btn btn-lg home-cta-btn-secondary">Create a Quiz</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}


function StatPill({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <span style={{ fontSize: "1.25rem" }}>{emoji}</span>
      <span className="font-display" style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--ink)" }}>{value}</span>
      <span style={{ fontSize: "0.875rem", color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

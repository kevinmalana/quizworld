import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Free Kahoot Alternative — No Limits, No Paywalls | QuizWorld",
  description:
    "QuizWorld is a free Kahoot alternative with unlimited questions, live multiplayer games, AI quiz generation, and no participant limits. Perfect for classrooms and trivia nights.",
  alternates: { canonical: "https://www.quizworld.xyz/kahoot-alternative" },
  openGraph: {
    title: "Free Kahoot Alternative — No Limits, No Paywalls | QuizWorld",
    description:
      "QuizWorld is a free Kahoot alternative with unlimited questions, live multiplayer games, AI quiz generation, and no participant limits.",
    url: "https://www.quizworld.xyz/kahoot-alternative",
    type: "website",
  },
};

const COMPARISON = [
  { feature: "Free to use", quizworld: "✅ Always free", kahoot: "⚠️ Limited free tier" },
  { feature: "Participant limit", quizworld: "✅ Unlimited", kahoot: "⚠️ 10 in free plan" },
  { feature: "Questions per quiz", quizworld: "✅ Unlimited", kahoot: "⚠️ Limited in free" },
  { feature: "AI quiz generation", quizworld: "✅ Built-in", kahoot: "❌ Paid add-on" },
  { feature: "Study mode", quizworld: "✅ Included", kahoot: "⚠️ Separate product" },
  { feature: "Sign-up to play", quizworld: "✅ No sign-up needed", kahoot: "⚠️ Recommended" },
  { feature: "Import from URL/PDF", quizworld: "✅ Included", kahoot: "❌ Not available" },
  { feature: "Public quiz library", quizworld: "✅ Thousands of quizzes", kahoot: "✅ Large library" },
];

export default function KahootAlternativePage() {
  return (
    <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem", maxWidth: "900px" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🎮</div>
        <h1 className="font-display" style={{ fontSize: "2.25rem", marginBottom: "1rem" }}>
          The Best Free Kahoot Alternative
        </h1>
        <p className="text-muted" style={{ fontSize: "1.1rem", maxWidth: "640px", margin: "0 auto 1.5rem" }}>
          QuizWorld gives you everything Kahoot does — live multiplayer games, classroom quizzes, leaderboards —
          without the paywalls or participant limits. Completely free, forever.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/create" className="btn btn-primary">
            ✨ Create a Free Quiz
          </Link>
          <Link href="/explore" className="btn btn-secondary">
            🔍 Browse Quizzes
          </Link>
        </div>
      </div>

      {/* Comparison table */}
      <h2 className="font-display" style={{ fontSize: "1.4rem", marginBottom: "1.25rem" }}>
        QuizWorld vs Kahoot
      </h2>
      <div className="card" style={{ marginBottom: "3rem", padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9375rem" }}>
          <thead>
            <tr style={{ background: "var(--surface)", borderBottom: "2px solid var(--line)" }}>
              <th style={{ padding: "0.875rem 1.25rem", textAlign: "left", fontWeight: 700, width: "40%" }}>
                Feature
              </th>
              <th
                style={{
                  padding: "0.875rem 1.25rem",
                  textAlign: "center",
                  fontWeight: 700,
                  background: "var(--primary-light)",
                  color: "var(--primary)",
                  width: "30%",
                }}
              >
                🌍 QuizWorld
              </th>
              <th
                style={{ padding: "0.875rem 1.25rem", textAlign: "center", fontWeight: 700, width: "30%" }}
              >
                Kahoot
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row, i) => (
              <tr
                key={row.feature}
                style={{
                  borderBottom: i < COMPARISON.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <td style={{ padding: "0.75rem 1.25rem", fontWeight: 500 }}>{row.feature}</td>
                <td
                  style={{
                    padding: "0.75rem 1.25rem",
                    textAlign: "center",
                    background: "var(--primary-light)",
                  }}
                >
                  {row.quizworld}
                </td>
                <td style={{ padding: "0.75rem 1.25rem", textAlign: "center" }}>{row.kahoot}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Key differentiators */}
      <h2 className="font-display" style={{ fontSize: "1.4rem", marginBottom: "1.25rem" }}>
        Why Teams Love QuizWorld
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "1.25rem",
          marginBottom: "3rem",
        }}
      >
        {[
          {
            icon: "🤖",
            title: "AI Quiz Builder",
            desc: "Paste a topic, URL, or document and let AI generate quiz questions in seconds.",
          },
          {
            icon: "🏆",
            title: "Live Leaderboards",
            desc: "Real-time competitive multiplayer with live scoring, streaks, and XP rewards.",
          },
          {
            icon: "📖",
            title: "Study Mode",
            desc: "Students can study solo with flashcard-style review, not just play live.",
          },
          {
            icon: "🔗",
            title: "Join Without Sign-Up",
            desc: "Players join by PIN — no accounts needed. Just share the code.",
          },
        ].map((item) => (
          <div key={item.title} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>{item.icon}</div>
            <h3 className="font-display" style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
              {item.title}
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", margin: 0 }}>
              {item.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Who uses it */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h2 className="font-display" style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
          Perfect for…
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {[
            "🏫 Teachers & Classrooms",
            "🧑‍💻 Corporate Training",
            "🎉 Trivia Nights",
            "👥 Team Building",
            "📚 Students Studying",
            "🎮 Gaming Communities",
            "🌍 Language Learners",
            "🔬 Science & Exam Prep",
          ].map((tag) => (
            <span
              key={tag}
              className="tag"
              style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "0.4rem 0.75rem" }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div
        style={{
          textAlign: "center",
          padding: "2.5rem",
          background: "linear-gradient(135deg, var(--primary-light) 0%, var(--surface) 100%)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--line)",
        }}
      >
        <h2 className="font-display" style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
          Switch to QuizWorld — It&apos;s Free
        </h2>
        <p className="text-muted" style={{ marginBottom: "1.5rem" }}>
          No credit card. No participant limits. No paywalls. Just great quizzes.
        </p>
        <Link href="/create" className="btn btn-primary" style={{ fontSize: "1.05rem", padding: "0.75rem 2rem" }}>
          Create Your First Quiz Free →
        </Link>
      </div>
    </div>
  );
}

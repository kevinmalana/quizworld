import Link from "next/link";

const lobbyPlayers = [
  { name: "Mia", avatar: "🦊", score: 0 },
  { name: "Jordan", avatar: "🦁", score: 0 },
  { name: "Noah", avatar: "🐉", score: 0 },
  { name: "Ava", avatar: "🦄", score: 0 },
];

const revealPlayers = [
  { name: "Mia", avatar: "🦊", score: 1860 },
  { name: "Jordan", avatar: "🦁", score: 1710 },
  { name: "Noah", avatar: "🐉", score: 980 },
  { name: "Ava", avatar: "🦄", score: 760 },
];

const answers = [
  { label: "A", text: "Mercury", color: "var(--answer-a)", surface: "var(--answer-a-surface)" },
  { label: "B", text: "Mars", color: "var(--answer-b)", surface: "var(--answer-b-surface)" },
  { label: "C", text: "Venus", color: "var(--answer-c)", surface: "var(--answer-c-surface)" },
  { label: "D", text: "Jupiter", color: "var(--answer-d)", surface: "var(--answer-d-surface)" },
];

const revealAnswers = [
  { label: "A", text: "Mercury", votes: 0, correct: false, color: "var(--answer-a)" },
  { label: "B", text: "Mars", votes: 3, correct: true, color: "var(--answer-b)" },
  { label: "C", text: "Venus", votes: 1, correct: false, color: "var(--answer-c)" },
  { label: "D", text: "Jupiter", votes: 0, correct: false, color: "var(--answer-d)" },
];

const finalPlayers = [
  { name: "Mia", avatar: "🦊", score: 6480, highlight: "Fastest finisher" },
  { name: "Jordan", avatar: "🦁", score: 6210, highlight: "Most accurate" },
  { name: "Noah", avatar: "🐉", score: 4490, highlight: "Big comeback" },
  { name: "Ava", avatar: "🦄", score: 3880, highlight: "Best streak" },
];

function shell(background: string) {
  return {
    borderRadius: 32,
    overflow: "hidden" as const,
    background,
    boxShadow: "0 28px 80px rgba(15,23,42,0.14)",
    border: "1px solid rgba(148,163,184,0.18)",
  };
}

function panel() {
  return {
    background: "rgba(255,255,255,0.94)",
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 28,
    boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
    backdropFilter: "blur(16px)",
  };
}

export default function PhoenixPreviewPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(124,58,237,0.14), transparent 32%), linear-gradient(180deg, #f4f5fb 0%, #eef3ff 100%)",
        padding: "3rem 0 5rem",
      }}
    >
      <style>{`
        .phoenix-preview-grid {
          display: grid;
          gap: 1.5rem;
        }

        .phoenix-stage-grid {
          display: grid;
          gap: 1.25rem;
          grid-template-columns: minmax(0, 1.7fr) minmax(290px, 0.9fr);
          align-items: start;
        }

        .phoenix-answer-grid {
          display: grid;
          gap: 0.85rem;
        }

        .phoenix-card-rise {
          animation: phoenix-rise 420ms ease-out both;
        }

        .phoenix-screen + .phoenix-screen {
          margin-top: 1.75rem;
        }

        .phoenix-rank {
          width: 2rem;
          height: 2rem;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: white;
          font-weight: 900;
          flex-shrink: 0;
        }

        @keyframes phoenix-rise {
          from {
            opacity: 0;
            transform: translateY(10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 980px) {
          .phoenix-stage-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="container">
        <section
          style={{
            ...shell("linear-gradient(145deg,#0f172a,#1e1b4b)"),
            padding: "2rem",
            color: "white",
            position: "relative",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "auto -6% -30% auto",
              width: 280,
              height: 280,
              borderRadius: 999,
              background: "radial-gradient(circle, rgba(96,165,250,0.3), transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div style={{ maxWidth: 760 }}>
              <div
                style={{
                  display: "inline-flex",
                  padding: "0.42rem 0.72rem",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  fontSize: "0.74rem",
                  fontWeight: 900,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#c4b5fd",
                  marginBottom: "0.9rem",
                }}
              >
                Phoenix LiveView Preview
              </div>
              <h1
                className="font-display"
                style={{
                  fontSize: "clamp(2.25rem,5vw,4.2rem)",
                  lineHeight: 0.95,
                  letterSpacing: "-0.05em",
                  fontWeight: 950,
                  marginBottom: "0.9rem",
                }}
              >
                QuizWorld game room, staged as a show.
              </h1>
              <p
                style={{
                  maxWidth: 700,
                  color: "rgba(255,255,255,0.8)",
                  fontSize: "1.05rem",
                }}
              >
                This is a static mockup of the Phoenix game experience: lobby, live question,
                answer reveal, and final results. It mirrors the LiveView design direction without
                requiring the Phoenix service to run.
              </p>
            </div>

            <div style={{ display: "grid", gap: "0.75rem", minWidth: 260 }}>
              <Link href="/host" className="btn btn-primary">
                Back to Host
              </Link>
              <Link href="/game/ABC123" className="btn btn-secondary">
                Open Current Game Page
              </Link>
            </div>
          </div>
        </section>

        <section className="phoenix-preview-grid">
          <div className="phoenix-screen phoenix-card-rise" style={shell("linear-gradient(180deg,#07111f 0%, #10253c 40%, #f7f9ff 40.01%, #f7f9ff 100%)")}>
            <div style={{ padding: "1.6rem" }} className="phoenix-stage-grid">
              <div style={{ ...panel(), padding: "1.4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                  <div>
                    <div style={{ fontSize: "0.74rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", marginBottom: "0.35rem" }}>
                      Lobby
                    </div>
                    <div className="font-display" style={{ fontSize: "2rem", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.03em" }}>
                      Waiting for the room to fill
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "0.7rem 1rem",
                      borderRadius: 999,
                      background: "#dcfce7",
                      color: "#166534",
                      fontSize: "0.78rem",
                      fontWeight: 900,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    Waiting
                  </div>
                </div>

                <div
                  style={{
                    padding: "1.4rem",
                    borderRadius: 26,
                    background: "linear-gradient(145deg,#0f172a,#1e293b)",
                    color: "white",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.12em", color: "#93c5fd", marginBottom: "0.7rem" }}>
                    On stage now
                  </div>
                  <div className="font-display" style={{ fontSize: "2.5rem", fontWeight: 950, letterSpacing: "0.16em" }}>
                    ABC123
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.76)", marginTop: "0.7rem" }}>
                    Share this PIN with the room. The host opens round one when the crowd feels ready.
                  </p>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                  {lobbyPlayers.map((player) => (
                    <div
                      key={player.name}
                      style={{
                        padding: "0.7rem 1rem",
                        borderRadius: 999,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontWeight: 800,
                        border: "1px solid #bfdbfe",
                      }}
                    >
                      {player.avatar} {player.name}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: "1rem" }}>
                <div style={{ ...panel(), padding: "1.15rem" }}>
                  <div style={{ fontSize: "0.74rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", marginBottom: "0.35rem" }}>
                    Host Deck
                  </div>
                  <div className="font-display" style={{ fontSize: "1.2rem", fontWeight: 900, color: "#0f172a", marginBottom: "0.85rem" }}>
                    Run the show
                  </div>
                  <button className="btn btn-primary" style={{ width: "100%" }}>
                    Open Round One
                  </button>
                </div>

                <div style={{ ...panel(), padding: "1.15rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.85rem", gap: "1rem" }}>
                    <div>
                      <div style={{ fontSize: "0.74rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", marginBottom: "0.35rem" }}>
                        Live Room
                      </div>
                      <div className="font-display" style={{ fontSize: "1.2rem", fontWeight: 900, color: "#0f172a" }}>
                        Players
                      </div>
                    </div>
                    <div style={{ color: "#64748b", fontWeight: 800 }}>4 joined</div>
                  </div>

                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    {lobbyPlayers.map((player, index) => (
                      <div
                        key={player.name}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "0.8rem",
                          alignItems: "center",
                          padding: "0.8rem",
                          borderRadius: 18,
                          background: index === 0 ? "#eff6ff" : "#f8fafc",
                          border: index === 0 ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                        }}
                      >
                        <span style={{ fontWeight: 850, color: "#0f172a" }}>
                          {player.avatar} {player.name}
                        </span>
                        <span style={{ color: "#64748b", fontWeight: 800 }}>Ready</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="phoenix-screen phoenix-card-rise" style={shell("linear-gradient(180deg,#081325 0%, #102845 40%, #eef4ff 40.01%, #eef4ff 100%)")}>
            <div style={{ padding: "1.6rem" }} className="phoenix-stage-grid">
              <div style={{ ...panel(), padding: "1.4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                  <div>
                    <div style={{ fontSize: "0.74rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", marginBottom: "0.35rem" }}>
                      Question
                    </div>
                    <div className="font-display" style={{ fontSize: "2rem", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.03em" }}>
                      Question in play
                    </div>
                  </div>
                  <div
                    style={{
                      width: 92,
                      height: 92,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: "#dbeafe",
                      color: "#1d4ed8",
                      fontWeight: 950,
                      fontSize: "2rem",
                      boxShadow: "inset 0 0 0 8px rgba(255,255,255,0.7)",
                    }}
                  >
                    12
                  </div>
                </div>

                <div
                  style={{
                    padding: "1.5rem 1.4rem",
                    borderRadius: 28,
                    background: "linear-gradient(145deg,#0f172a,#1e293b)",
                    color: "white",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.12em", color: "#93c5fd", marginBottom: "0.8rem" }}>
                    Question on deck
                  </div>
                  <div className="font-display" style={{ fontSize: "2rem", lineHeight: 1.05, fontWeight: 950, letterSpacing: "-0.04em" }}>
                    Which planet is known as the Red Planet?
                  </div>
                </div>

                <div className="phoenix-answer-grid">
                  {answers.map((answer, index) => (
                    <div
                      key={answer.label}
                      style={{
                        display: "flex",
                        gap: "0.95rem",
                        alignItems: "center",
                        padding: "1rem 1.05rem",
                        borderRadius: 22,
                        background: index === 1 ? answer.surface : "white",
                        border: `2px solid ${index === 1 ? answer.color : "#dbe2ef"}`,
                        boxShadow: index === 1 ? "0 14px 35px rgba(37,99,235,0.12)" : "0 10px 22px rgba(15,23,42,0.05)",
                      }}
                    >
                      <div
                        style={{
                          width: "2.5rem",
                          height: "2.5rem",
                          borderRadius: 999,
                          display: "grid",
                          placeItems: "center",
                          background: index === 1 ? answer.color : "#e2e8f0",
                          color: index === 1 ? "white" : "#334155",
                          fontWeight: 950,
                          flexShrink: 0,
                        }}
                      >
                        {answer.label}
                      </div>
                      <div style={{ flex: 1, fontWeight: 850, color: "#0f172a" }}>{answer.text}</div>
                      {index === 1 ? (
                        <div style={{ fontSize: "0.78rem", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: answer.color }}>
                          Locked
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: "1rem" }}>
                <div style={{ ...panel(), padding: "1.15rem" }}>
                  <div style={{ fontSize: "0.74rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", marginBottom: "0.35rem" }}>
                    Host View
                  </div>
                  <div className="font-display" style={{ fontSize: "1.2rem", fontWeight: 900, color: "#0f172a", marginBottom: "0.65rem" }}>
                    Pressure is rising
                  </div>
                  <p style={{ color: "#64748b", marginBottom: "1rem" }}>
                    3 of 4 players have answered. The host can reveal when the round peaks.
                  </p>
                  <button className="btn btn-secondary" style={{ width: "100%" }}>
                    Reveal Answers
                  </button>
                </div>

                <div style={{ ...panel(), padding: "1.15rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.85rem", gap: "1rem" }}>
                    <div>
                      <div style={{ fontSize: "0.74rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", marginBottom: "0.35rem" }}>
                        Standings
                      </div>
                      <div className="font-display" style={{ fontSize: "1.2rem", fontWeight: 900, color: "#0f172a" }}>
                        Live leaderboard
                      </div>
                    </div>
                    <div style={{ color: "#64748b", fontWeight: 800 }}>Question 3/10</div>
                  </div>

                  <div style={{ display: "grid", gap: "0.7rem" }}>
                    {revealPlayers.map((player, index) => (
                      <div
                        key={player.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.75rem",
                          padding: "0.8rem",
                          borderRadius: 18,
                          background: index === 0 ? "#fef3c7" : "#f8fafc",
                          border: index === 0 ? "1px solid #fcd34d" : "1px solid #e2e8f0",
                        }}
                      >
                        <span style={{ fontWeight: 850, color: "#0f172a" }}>
                          {player.avatar} {player.name}
                        </span>
                        <span style={{ fontWeight: 900, color: "#0f172a" }}>{player.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="phoenix-screen phoenix-card-rise" style={shell("linear-gradient(180deg,#2c1208 0%, #5f2508 40%, #fff7ed 40.01%, #fff7ed 100%)")}>
            <div style={{ padding: "1.6rem" }} className="phoenix-stage-grid">
              <div style={{ ...panel(), padding: "1.4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                  <div>
                    <div style={{ fontSize: "0.74rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", marginBottom: "0.35rem" }}>
                      Reveal
                    </div>
                    <div className="font-display" style={{ fontSize: "2rem", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.03em" }}>
                      Answers on the board
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "0.7rem 1rem",
                      borderRadius: 999,
                      background: "#ffedd5",
                      color: "#c2410c",
                      fontSize: "0.78rem",
                      fontWeight: 900,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    Reveal
                  </div>
                </div>

                <div
                  style={{
                    padding: "1.35rem 1.3rem",
                    borderRadius: 28,
                    background: "linear-gradient(145deg,#fff7ed,#ffffff)",
                    border: "1px solid #fdba74",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.12em", color: "#c2410c", marginBottom: "0.75rem" }}>
                    Reveal
                  </div>
                  <div className="font-display" style={{ fontSize: "1.9rem", fontWeight: 950, lineHeight: 1.08, letterSpacing: "-0.04em", color: "#7c2d12" }}>
                    Which planet is known as the Red Planet?
                  </div>
                </div>

                <div
                  style={{
                    padding: "1rem 1.1rem",
                    borderRadius: 18,
                    background: "#dcfce7",
                    color: "#166534",
                    border: "1px solid #86efac",
                    fontWeight: 800,
                    marginBottom: "1rem",
                  }}
                >
                  <strong>Correct.</strong> You earned 920 points.
                </div>

                <div className="phoenix-answer-grid">
                  {revealAnswers.map((answer) => (
                    <div
                      key={answer.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "1rem",
                        alignItems: "center",
                        padding: "1rem 1.05rem",
                        borderRadius: 20,
                        background: answer.correct ? "linear-gradient(145deg,#dcfce7,#f0fdf4)" : "white",
                        border: answer.correct ? "2px solid #16a34a" : "1px solid #e5e7eb",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "1rem", fontWeight: 850, color: "#0f172a" }}>
                          {answer.label}. {answer.text}
                        </div>
                        <div style={{ fontSize: "0.84rem", color: "#64748b", fontWeight: 700, marginTop: "0.25rem" }}>
                          {answer.votes} players locked this in
                        </div>
                      </div>
                      <div
                        style={{
                          padding: "0.5rem 0.72rem",
                          borderRadius: 999,
                          background: answer.correct ? "#16a34a" : "#e2e8f0",
                          color: answer.correct ? "white" : "#475569",
                          fontSize: "0.72rem",
                          fontWeight: 900,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        {answer.correct ? "Correct" : "Miss"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ ...panel(), padding: "1.15rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.85rem", gap: "1rem" }}>
                  <div>
                    <div style={{ fontSize: "0.74rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", marginBottom: "0.35rem" }}>
                      Leaderboard
                    </div>
                    <div className="font-display" style={{ fontSize: "1.2rem", fontWeight: 900, color: "#0f172a" }}>
                      Round standings
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm">Next Question</button>
                </div>

                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {revealPlayers.map((player, index) => (
                    <div
                      key={player.name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "0.85rem",
                        padding: "0.85rem",
                        borderRadius: 18,
                        background:
                          index === 0
                            ? "linear-gradient(145deg,#fef3c7,#fffbeb)"
                            : index === 1
                              ? "linear-gradient(145deg,#e2e8f0,#f8fafc)"
                              : index === 2
                                ? "linear-gradient(145deg,#fed7aa,#fff7ed)"
                                : "#f8fafc",
                        border:
                          index === 0
                            ? "1px solid #fcd34d"
                            : index === 1
                              ? "1px solid #cbd5e1"
                              : index === 2
                                ? "1px solid #fdba74"
                                : "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                        <div
                          className="phoenix-rank"
                          style={{
                            background:
                              index === 0 ? "#f59e0b" : index === 1 ? "#94a3b8" : index === 2 ? "#c2410c" : "#0f172a",
                          }}
                        >
                          {index + 1}
                        </div>
                        <div style={{ fontWeight: 850, color: "#0f172a" }}>
                          {player.avatar} {player.name}
                        </div>
                      </div>
                      <div style={{ fontWeight: 900, color: "#0f172a" }}>{player.score}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="phoenix-screen phoenix-card-rise" style={shell("linear-gradient(180deg,#1b1235 0%, #3c1d74 40%, #f6f2ff 40.01%, #f6f2ff 100%)")}>
            <div style={{ padding: "1.6rem" }}>
              <div
                style={{
                  ...panel(),
                  padding: "1.5rem",
                  marginBottom: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.74rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", marginBottom: "0.35rem" }}>
                    Final Result
                  </div>
                  <div className="font-display" style={{ fontSize: "2.2rem", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.03em" }}>
                    The leaderboard is locked.
                  </div>
                  <p style={{ color: "#64748b", marginTop: "0.4rem" }}>
                    Final standings after ten questions and one very loud room.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button className="btn btn-primary">Host Rematch</button>
                  <button className="btn btn-secondary">Share Results</button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "1rem",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                {finalPlayers.map((player, index) => (
                  <div
                    key={player.name}
                    style={{
                      ...panel(),
                      padding: "1.2rem",
                      background:
                        index === 0
                          ? "linear-gradient(145deg,#fef3c7,#fff7cc)"
                          : index === 1
                            ? "linear-gradient(145deg,#eef2ff,#f8fafc)"
                            : index === 2
                              ? "linear-gradient(145deg,#ffedd5,#fff7ed)"
                              : "rgba(255,255,255,0.94)",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        padding: "0.42rem 0.72rem",
                        borderRadius: 999,
                        background: index === 0 ? "#f59e0b" : "rgba(15,23,42,0.08)",
                        color: index === 0 ? "white" : "#475569",
                        fontSize: "0.72rem",
                        fontWeight: 900,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        marginBottom: "0.8rem",
                      }}
                    >
                      {index === 0 ? "Winner" : `Place ${index + 1}`}
                    </div>
                    <div className="font-display" style={{ fontSize: "1.4rem", fontWeight: 900, color: "#0f172a", marginBottom: "0.2rem" }}>
                      {player.avatar} {player.name}
                    </div>
                    <div style={{ fontSize: "2rem", fontWeight: 950, letterSpacing: "-0.03em", color: "#0f172a" }}>
                      {player.score}
                    </div>
                    <div style={{ color: "#64748b", fontWeight: 700, marginTop: "0.45rem" }}>{player.highlight}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

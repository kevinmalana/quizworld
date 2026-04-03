import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a2e",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Background accent */}
        <div
          style={{
            position: "absolute",
            top: -100,
            right: -100,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, #6366f1 0%, transparent 70%)",
            opacity: 0.4,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -150,
            left: -150,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, #ec4899 0%, transparent 70%)",
            opacity: 0.3,
          }}
        />

        {/* Brain emoji */}
        <div style={{ fontSize: 96, marginBottom: 24 }}>🧠</div>

        {/* Title */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.02em",
            marginBottom: 16,
          }}
        >
          QuizWorld
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: "#a5b4fc",
            fontWeight: 400,
            marginBottom: 40,
          }}
        >
          AI-Powered Live Quizzes
        </div>

        {/* Features */}
        <div
          style={{
            display: "flex",
            gap: 32,
            fontSize: 20,
            color: "#94a3b8",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>✨</span> AI Generated
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>🎮</span> Multiplayer
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>📚</span> Study Mode
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

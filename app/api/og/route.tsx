import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "QuizWorld Quiz";
  const category = searchParams.get("category") || "General Knowledge";
  const count = searchParams.get("count") || "10";
  const emoji = searchParams.get("emoji") || "🧠";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 80, marginBottom: 24 }}>{emoji}</div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: "white",
            textAlign: "center",
            lineHeight: 1.2,
            marginBottom: 16,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "rgba(255,255,255,0.8)",
            marginBottom: 32,
          }}
        >
          {count} Questions · {category}
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.2)",
            borderRadius: 50,
            padding: "12px 32px",
            fontSize: 22,
            color: "white",
            fontWeight: 700,
          }}
        >
          Play Free on QuizWorld →
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

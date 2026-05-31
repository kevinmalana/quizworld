import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export async function POST(req: NextRequest) {
  // Auth check
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }

  const gameData = body.gameData as Record<string, unknown>;
  if (!gameData) return NextResponse.json({ error: "gameData is required." }, { status: 400 });

  const apiKey = requireEnv("QUIZWORLD_AI_API_KEY");
  const apiUrl = process.env.QUIZWORLD_AI_API_URL || "https://api.groq.com/openai/v1";
  const model = process.env.QUIZWORLD_AI_MODEL || "llama-3.3-70b-versatile";

  const gameMode = (gameData.game_mode as string) || "classic";
  const totalPlayers = gameData.total_players as number;
  const totalQuestions = gameData.total_questions as number;
  const avgScore = gameData.avg_score as number;
  const avgAccuracy = gameData.avg_accuracy as number;
  const leaderboard = gameData.leaderboard as { nickname: string; score: number; correct: number }[];
  const questionStats = gameData.question_stats as { text: string; correct_pct: number; avg_time: number }[];
  const eliminated = (gameData.eliminated as string[]) || [];
  const teams = (gameData.teams as { name: string; score: number; emoji: string }[]) || [];

  const modeContext = gameMode === "survival"
    ? `Game mode: SURVIVAL. ${eliminated.length} of ${totalPlayers} players were eliminated. ${totalPlayers - eliminated.length} survived.`
    : gameMode === "team"
    ? `Game mode: TEAM BATTLE. Teams: ${teams.map(t => `${t.emoji} ${t.name}: ${t.score.toLocaleString()} pts`).join(", ")}.`
    : `Game mode: CLASSIC.`;

  const hardestQ = questionStats?.length
    ? [...questionStats].sort((a, b) => a.correct_pct - b.correct_pct)[0]
    : null;
  const easiestQ = questionStats?.length
    ? [...questionStats].sort((a, b) => b.correct_pct - a.correct_pct)[0]
    : null;

  const prompt = `You are analyzing a live quiz game for the host. Give 4 short, specific, actionable insights.

Game summary:
- ${modeContext}
- Players: ${totalPlayers}
- Questions: ${totalQuestions}
- Avg score: ${avgScore?.toLocaleString()} pts
- Avg accuracy: ${avgAccuracy}%
- Top player: ${leaderboard?.[0]?.nickname} (${leaderboard?.[0]?.correct}/${totalQuestions} correct)
${hardestQ ? `- Hardest question (${hardestQ.correct_pct}% correct): "${hardestQ.text}"` : ""}
${easiestQ ? `- Easiest question (${easiestQ.correct_pct}% correct): "${easiestQ.text}"` : ""}

Write exactly 4 bullet points (use • symbol). Each should be 1-2 sentences. Be specific, not generic. Focus on what the host can learn or do next time.`;

  try {
    const res = await fetch(`${apiUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        messages: [
          { role: "system", content: "You are a helpful quiz analytics assistant. Be concise and specific." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: (err as { error?: { message?: string } }).error?.message || "AI service error." }, { status: 502 });
    }

    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const insights = data.choices?.[0]?.message?.content?.trim() || "No insights available.";
    return NextResponse.json({ insights });
  } catch (err) {
    console.error("AI insights error:", err);
    return NextResponse.json({ error: "Could not generate insights." }, { status: 500 });
  }
}

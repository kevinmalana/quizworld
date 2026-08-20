import { NextRequest, NextResponse } from "next/server";

import {
  buildAIPresentationPrompt,
  normalizeAIPresentationRequest,
  validateAIPresentationDraft,
} from "@/lib/presentation/ai-draft";
import { sanitizeJsonString } from "@/lib/quiz-ai";
import { checkRateLimit } from "@/lib/rate-limit";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const generationRequest = normalizeAIPresentationRequest(await request.json());
    const apiKey = requireEnv("QUIZWORLD_AI_API_KEY");
    const model = requireEnv("QUIZWORLD_AI_MODEL");
    const apiUrl =
      process.env.QUIZWORLD_AI_API_URL?.trim() || "https://api.openai.com/v1/chat/completions";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You create concise, accurate, audience-ready interactive presentations. Return valid JSON only. Never include markdown fences or commentary outside the JSON object.",
          },
          {
            role: "user",
            content: buildAIPresentationPrompt(generationRequest),
          },
        ],
        temperature: 0.35,
      }),
    });

    const payload = (await response.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.error?.message || "AI provider request failed." },
        { status: 502 },
      );
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({ error: "AI provider returned an empty response." }, { status: 502 });
    }

    const draft = validateAIPresentationDraft(JSON.parse(sanitizeJsonString(content)));
    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation failed.";

    if (message.startsWith("Missing QUIZWORLD_AI_")) {
      return NextResponse.json(
        {
          error:
            "AI generation is not configured. Set QUIZWORLD_AI_API_KEY and QUIZWORLD_AI_MODEL on the Next.js app.",
        },
        { status: 503 },
      );
    }

    if (
      message.includes("source material") ||
      message.includes("topic or goal") ||
      message.startsWith("AI response") ||
      message.startsWith("Slide ")
    ) {
      return NextResponse.json({ error: message }, { status: 422 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

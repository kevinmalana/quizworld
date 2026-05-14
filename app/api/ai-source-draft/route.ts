import { NextResponse } from "next/server";
import {
  buildAIQuizPrompt,
  sanitizeJsonString,
  validateAIQuizDraft,
  DEFAULT_AI_OPTIONS,
  type AIGenerationOptions,
} from "@/lib/quiz-ai";
import { checkRateLimit } from "@/lib/rate-limit";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export async function POST(request: Request) {
  // Rate limiting
  const rateLimitResponse = checkRateLimit(request as any);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = (await request.json()) as {
      sourceText?: string;
      sourceTitle?: string;
      sourceLabel?: string;
      questionCount?: number;
      aiOptions?: AIGenerationOptions;
    };

    const sourceText = body.sourceText?.trim() ?? "";
    const sourceTitle = body.sourceTitle?.trim() ?? "";
    const sourceLabel = body.sourceLabel?.trim() ?? "Source material";
    const questionCount = Math.min(10, Math.max(3, Number(body.questionCount) || 5));
    const aiOptions = body.aiOptions ?? DEFAULT_AI_OPTIONS;

    if (!sourceText || sourceText.length < 200) {
      return NextResponse.json(
        { error: "Add more source material before generating a quiz draft." },
        { status: 400 }
      );
    }

    const apiKey = requireEnv("QUIZWORLD_AI_API_KEY");
    const model = requireEnv("QUIZWORLD_AI_MODEL");
    const apiUrl =
      process.env.QUIZWORLD_AI_API_URL?.trim() ||
      "https://api.openai.com/v1/chat/completions";

    const prompt = buildAIQuizPrompt({
      sourceTitle,
      sourceLabel,
      sourceText: sourceText.slice(0, 24000),
      questionCount,
      aiOptions,
    });

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
              "You generate conservative, source-grounded quiz drafts. Never invent support outside the provided source.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
      }),
    });

    const payload = (await response.json()) as {
      error?: { message?: string };
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.error?.message || "AI provider request failed." },
        { status: 502 }
      );
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "AI provider returned an empty response." },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(sanitizeJsonString(content));
    const draft = validateAIQuizDraft(parsed);

    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation failed.";

    if (message.startsWith("Missing QUIZWORLD_AI_")) {
      return NextResponse.json(
        {
          error:
            "AI generation is not configured. Set QUIZWORLD_AI_API_KEY and QUIZWORLD_AI_MODEL on the Next.js app.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

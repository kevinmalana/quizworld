import { NextResponse } from "next/server";
import {
  buildEnrichmentPrompt,
  sanitizeJsonString,
  type AIDifficultyLevel,
} from "@/lib/quiz-ai";
import { checkRateLimit } from "@/lib/rate-limit";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

type EnrichmentResult = {
  explanation: string;
  difficulty: AIDifficultyLevel;
  confidence: "high" | "medium" | "low";
};

export async function POST(request: Request) {
  const rateLimitResponse = await checkRateLimit(request as any);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = (await request.json()) as {
      questions?: Array<{
        text: string;
        answers: Array<{ text: string; is_correct: boolean }>;
      }>;
      sourceText?: string;
    };

    const questions = body.questions ?? [];
    const sourceText = body.sourceText?.trim();

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No questions provided to enrich." },
        { status: 400 }
      );
    }

    if (questions.length > 20) {
      return NextResponse.json(
        { error: "Can only enrich up to 20 questions at a time." },
        { status: 400 }
      );
    }

    const apiKey = requireEnv("QUIZWORLD_AI_API_KEY");
    const model = requireEnv("QUIZWORLD_AI_MODEL");
    const apiUrl =
      process.env.QUIZWORLD_AI_API_URL?.trim() ||
      "https://api.openai.com/v1/chat/completions";

    const prompt = buildEnrichmentPrompt({ questions, sourceText });

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
            content: `You are a quiz quality reviewer and educator.

For each question:
- Write a clear explanation (2-3 sentences) that teaches the concept
- Rate difficulty accurately: easy = basic recall, medium = understanding, hard = analysis
- Rate confidence: high = unambiguous, medium = slight ambiguity, low = question may be flawed

Explanations should:
- Teach the "why" behind the correct answer
- Be concise and clear
- Not just restate the answer

OUTPUT: Valid JSON only. No markdown fences.`,
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
    const rawEnrichments = Array.isArray(parsed.enrichments) ? parsed.enrichments : [];

    const enrichments: EnrichmentResult[] = rawEnrichments.map(
      (item: Record<string, unknown>, index: number) => {
        const explanation =
          typeof item.explanation === "string" ? item.explanation.trim() : "";
        const difficulty: AIDifficultyLevel =
          item.difficulty === "easy" || item.difficulty === "hard"
            ? item.difficulty
            : "medium";
        const confidence: "high" | "medium" | "low" =
          item.confidence === "high" || item.confidence === "low"
            ? item.confidence
            : "medium";

        return { explanation, difficulty, confidence };
      }
    );

    // Pad with defaults if AI returned fewer enrichments than questions
    while (enrichments.length < questions.length) {
      enrichments.push({
        explanation: "",
        difficulty: "medium",
        confidence: "medium",
      });
    }

    return NextResponse.json({
      enrichments: enrichments.slice(0, questions.length),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Enrichment failed.";

    if (message.startsWith("Missing QUIZWORLD_AI_")) {
      return NextResponse.json(
        {
          error:
            "AI enrichment is not configured. Set QUIZWORLD_AI_API_KEY and QUIZWORLD_AI_MODEL on the Next.js app.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

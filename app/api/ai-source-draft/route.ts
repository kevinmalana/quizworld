import { NextResponse } from "next/server";
import {
  buildAIQuizPrompt,
  sanitizeJsonString,
  validateAIQuizDraft,
  detectDuplicateQuestions,
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
      // "topic" = LLM uses its own knowledge; skip source-length checks
      // "url" | "paste" | "document" = source text must be substantive
      sourceMode?: "topic" | "url" | "paste" | "document";
    };

    const sourceText = body.sourceText?.trim() ?? "";
    const sourceTitle = body.sourceTitle?.trim() ?? "";
    const sourceLabel = body.sourceLabel?.trim() ?? "Source material";
    const questionCount = Math.min(10, Math.max(3, Number(body.questionCount) || 5));
    const aiOptions = body.aiOptions ?? DEFAULT_AI_OPTIONS;
    const sourceMode = body.sourceMode ?? "paste";

    // For topic mode the LLM generates from its own knowledge — the sourceText
    // is just a prompt hint, so length-based guards don't apply.
    if (sourceMode !== "topic") {
      if (!sourceText || sourceText.length < 200) {
        return NextResponse.json(
          { error: "Add more source material before generating a quiz draft." },
          { status: 400 }
        );
      }

      // Source-to-question ratio: require ~150 chars per question minimum
      const minSourceLength = questionCount * 150;
      if (sourceText.length < minSourceLength) {
        const suggestion =
          sourceMode === "url"
            ? `This page doesn't have enough readable text for ${questionCount} questions. Try a longer article, or paste the content directly.`
            : `Not enough source material for ${questionCount} questions. Add more text or reduce the question count.`;
        return NextResponse.json({ error: suggestion }, { status: 400 });
      }
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
      sourceMode,
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
            content: `You are a quiz author for educational and entertainment use.

HARD RULES:
- Every question MUST be answerable from the source text provided
- The correct answer MUST be factually accurate
- Each wrong answer (distractor) MUST be plausible — a real person might pick it
- Never generate two questions that test the same fact or concept
- If the source text doesn't cover enough material, generate fewer questions rather than inventing facts
- Match difficulty to the audience: "easy" means most people would know it, "hard" means only experts would

DIFFICULTY CALIBRATION:
- Easy: recall of basic facts (What is...? Which one...?)
- Medium: understanding or application (Why does...? What happens if...?)
- Hard: analysis or synthesis (Compare...? What would happen if...?)

ANSWER QUALITY:
- Wrong answers should be similar in length and style to the correct answer
- Never use "All of the above" or "None of the above"
- Avoid giveaways: the longest answer is often correct — vary answer lengths
- Each question should test a distinct concept

OUTPUT: Valid JSON only. No markdown fences. No commentary outside JSON.`,
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

    // Remove duplicate questions
    const duplicateIndices = detectDuplicateQuestions(draft.questions);
    if (duplicateIndices.length > 0) {
      draft.questions = draft.questions.filter((_, i) => !duplicateIndices.includes(i));
    }

    // If we removed too many, that's still fine — return what we have
    if (draft.questions.length === 0) {
      return NextResponse.json(
        { error: "AI generated duplicate questions. Try with more specific source material." },
        { status: 422 }
      );
    }

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

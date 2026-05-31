import { uid, type Question } from "@/lib/store";

export type AIQuestionCitation = {
  snippet: string;
  source_label: string;
};

export type AIDifficultyLevel = "easy" | "medium" | "hard";

export type AIQuestionDraft = {
  text: string;
  question_type: "multiple_choice" | "true_false";
  time_limit: number;
  points: number;
  confidence: "high" | "medium" | "low";
  difficulty: AIDifficultyLevel;
  rationale: string;
  explanation: string;
  answers: Array<{
    text: string;
    is_correct: boolean;
  }>;
  citations: AIQuestionCitation[];
};

export type AIQuizDraft = {
  title: string;
  summary: string;
  questions: AIQuestionDraft[];
};

// ── Generation options shared between UI and prompt ────────

export type AIDifficultyPreset = "easy" | "balanced" | "hard" | "mixed";
export type AITonePreset = "educational" | "fun" | "exam" | "challenging";

export type AIGenerationOptions = {
  audience: string;
  difficulty: AIDifficultyPreset;
  questionTypes: { mc: boolean; tf: boolean };
  focusAreas: string;
  tone: AITonePreset;
};

export const DEFAULT_AI_OPTIONS: AIGenerationOptions = {
  audience: "",
  difficulty: "balanced",
  questionTypes: { mc: true, tf: true },
  focusAreas: "",
  tone: "educational",
};

export function sanitizeJsonString(raw: string) {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fencedMatch ? fencedMatch[1] : raw).trim();
}

function normalizeTimeLimit(value: number) {
  const options = [10, 20, 30, 60];
  return options.reduce((best, current) =>
    Math.abs(current - value) < Math.abs(best - value) ? current : best
  );
}

function normalizePoints(value: number) {
  const options = [500, 1000, 2000];
  return options.reduce((best, current) =>
    Math.abs(current - value) < Math.abs(best - value) ? current : best
  );
}

export function validateAIQuizDraft(input: unknown): AIQuizDraft {
  if (!input || typeof input !== "object") {
    throw new Error("AI response was not valid JSON.");
  }

  const value = input as Record<string, unknown>;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const summary = typeof value.summary === "string" ? value.summary.trim() : "";
  const rawQuestions = Array.isArray(value.questions) ? value.questions : [];

  if (!title) {
    throw new Error("AI response did not include a quiz title.");
  }

  if (rawQuestions.length === 0) {
    throw new Error("AI response did not include any questions.");
  }

  const questions = rawQuestions.reduce<AIQuestionDraft[]>((acc, question, index) => {
    // Skip malformed questions instead of throwing — one bad question shouldn't kill the whole batch
    if (!question || typeof question !== "object") return acc;

    const q = question as Record<string, unknown>;
    const text = typeof q.text === "string" ? q.text.trim() : "";
    if (!text) return acc; // skip blank questions

    const rawType = typeof q.question_type === "string" ? q.question_type : "multiple_choice";
    const questionType: AIQuestionDraft["question_type"] =
      rawType === "true_false" ? "true_false" : "multiple_choice";
    const timeLimit = typeof q.time_limit === "number" ? q.time_limit : 20;
    const points = typeof q.points === "number" ? q.points : 1000;
    const confidence: AIQuestionDraft["confidence"] =
      q.confidence === "high" || q.confidence === "medium" || q.confidence === "low"
        ? q.confidence
        : "medium";
    const difficulty: AIDifficultyLevel =
      q.difficulty === "easy" || q.difficulty === "hard" ? q.difficulty : "medium";
    const rationale = typeof q.rationale === "string" ? q.rationale.trim() : "";
    const explanation = typeof q.explanation === "string" ? q.explanation.trim() : "";
    const rawAnswers = Array.isArray(q.answers) ? q.answers : [];
    const rawCitations = Array.isArray(q.citations) ? q.citations : [];

    if (rawAnswers.length < 2) return acc; // skip questions with too few answers

    const answers = rawAnswers.reduce<{ text: string; is_correct: boolean }[]>((ansAcc, answer) => {
      if (!answer || typeof answer !== "object") return ansAcc;
      const a = answer as Record<string, unknown>;
      const answerText = typeof a.text === "string" ? a.text.trim() : "";
      if (!answerText) return ansAcc;
      ansAcc.push({ text: answerText, is_correct: Boolean(a.is_correct) });
      return ansAcc;
    }, []);

    if (answers.length < 2) return acc;
    if (answers.filter((a) => a.is_correct).length !== 1) return acc; // must have exactly one correct

    const citations = rawCitations
      .filter((citation) => citation && typeof citation === "object")
      .map((citation) => {
        const c = citation as Record<string, unknown>;
        return {
          snippet: typeof c.snippet === "string" ? c.snippet.trim() : "",
          source_label:
            typeof c.source_label === "string" ? c.source_label.trim() : "Source",
        };
      })
      .filter((citation) => citation.snippet);

    acc.push({
      text,
      question_type: questionType,
      time_limit: normalizeTimeLimit(timeLimit),
      points: normalizePoints(points),
      confidence,
      difficulty,
      rationale,
      explanation,
      answers,
      citations,
    });
    return acc;
  }, []);

  return {
    title,
    summary,
    questions,
  };
}

/**
 * Check for duplicate/near-duplicate questions in a draft.
 * Returns indices of questions that are too similar to earlier questions.
 */
export function detectDuplicateQuestions(questions: AIQuestionDraft[]): number[] {
  const duplicates: number[] = [];

  function getKeywords(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
    );
  }

  function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    const intersection = new Set([...a].filter((x) => b.has(x)));
    const union = new Set([...a, ...b]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  for (let i = 0; i < questions.length; i++) {
    for (let j = 0; j < i; j++) {
      const keywordsA = getKeywords(questions[i].text);
      const keywordsB = getKeywords(questions[j].text);
      const similarity = jaccardSimilarity(keywordsA, keywordsB);

      // Also check if correct answers are the same
      const correctA = questions[i].answers.find((a) => a.is_correct)?.text.toLowerCase() ?? "";
      const correctB = questions[j].answers.find((a) => a.is_correct)?.text.toLowerCase() ?? "";
      const sameAnswer = correctA === correctB && correctA.length > 0;

      if (similarity > 0.6 || sameAnswer) {
        duplicates.push(i);
        break;
      }
    }
  }

  return [...new Set(duplicates)];
}

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "has", "her", "was", "one",
  "our", "out", "this", "that", "with", "have", "from", "they", "been", "said", "each",
  "which", "their", "will", "other", "about", "many", "then", "them", "these", "some",
  "would", "make", "like", "into", "time", "very", "when", "come", "could", "more",
  "than", "what", "your", "how", "its", "also", "did", "just", "true", "false",
]);

export function aiDraftToQuestions(draft: AIQuizDraft): Question[] {
  return draft.questions.map((question) => ({
    id: uid(),
    text: question.text,
    timeLimit: question.time_limit,
    points: question.points,
    answers: question.answers.map((answer) => ({
      id: uid(),
      text: answer.text,
      isCorrect: answer.is_correct,
    })),
  }));
}

// ── Helpers for options → prompt instructions ────────────────

function difficultyInstruction(difficulty: AIDifficultyPreset): string {
  switch (difficulty) {
    case "easy":
      return "Generate mostly easy questions (70% easy, 20% medium, 10% hard). Use 30-second timers and 500 points for most questions.";
    case "balanced":
      return "Mix difficulties: 30% easy, 50% medium, 20% hard. Use appropriate timers and points for each.";
    case "hard":
      return "Generate mostly challenging questions (10% easy, 30% medium, 60% hard). Use 10-second timers and 2000 points for hard questions.";
    case "mixed":
      return "Mix all difficulties evenly: 33% easy, 34% medium, 33% hard.";
  }
}

function toneInstruction(tone: AITonePreset): string {
  switch (tone) {
    case "educational":
      return "Write clear, educational questions that teach concepts. Explanations should be instructive.";
    case "fun":
      return "Write engaging, fun questions with a casual tone. Include interesting facts and trivia-style phrasing.";
    case "exam":
      return "Write exam-style questions that test understanding. Use formal language. Explanations should mirror textbook clarity.";
    case "challenging":
      return "Write tricky, challenging questions that require deep thinking. Use plausible distractors and nuanced phrasing.";
  }
}

function questionTypeInstruction(types: { mc: boolean; tf: boolean }): string {
  if (types.mc && types.tf) {
    return "Generate a mix of multiple_choice and true_false questions (about 70% MC, 30% T/F).";
  }
  if (types.tf) {
    return "Generate only true_false questions. Every question must have question_type \"true_false\" with exactly 2 answers (True/False).";
  }
  return "Generate only multiple_choice questions. Every question must have question_type \"multiple_choice\" with EXACTLY 4 answers — 1 marked is_correct: true and 3 marked is_correct: false.";
}

// ── Main prompt builder ──────────────────────────────────────

export function buildAIQuizPrompt(options: {
  sourceTitle: string;
  sourceLabel: string;
  sourceText: string;
  questionCount: number;
  aiOptions?: AIGenerationOptions;
  sourceMode?: "topic" | "url" | "paste" | "document";
}) {
  const opts = options.aiOptions ?? DEFAULT_AI_OPTIONS;
  const isTopicMode = options.sourceMode === "topic";

  const audienceLine = opts.audience
    ? `\n- Target audience: ${opts.audience}. Adjust language complexity and topic depth accordingly.`
    : "";

  const focusLine = opts.focusAreas
    ? `\n- Focus specifically on these areas: ${opts.focusAreas}. Dedicate more questions to these topics.`
    : "";

  const sourceInstruction = isTopicMode
    ? `- Generate questions using your own knowledge about this topic. The source text is a hint, not a constraint.\n- Ensure every answer is factually accurate.`
    : `- Every question must be answerable from the provided source text.\n- Each citation must quote a short exact snippet from the source text that supports the answer.`;

  const citationInstruction = isTopicMode
    ? `- Citations are optional for topic mode; omit them or leave citations as an empty array [] if not applicable.`
    : `- Include 1 to 2 citations per question.`;

  return `
You are generating a quiz draft${isTopicMode ? " about a topic" : " from source material"}. Generate questions that match the user's preferences.

Requirements:
- Return valid JSON only.
- Generate exactly ${options.questionCount} questions.
${sourceInstruction}
${questionTypeInstruction(opts.questionTypes)}
- Exactly one answer must be correct per question.
- Avoid trivial wording copied directly from the source.
- Include a short rationale for the correct answer.
- Include a clear explanation (2-3 sentences) that teaches the concept. This will be shown to students after they answer.
${citationInstruction}
- Use time_limit values of 10, 20, 30, or 60.
- Use points values of 500, 1000, or 2000.
- Confidence must be one of: high, medium, low.
- Difficulty must be one of: easy, medium, hard.
- If the source is weak or ambiguous, reduce confidence and keep the question conservative.
${audienceLine}${focusLine}
- ${difficultyInstruction(opts.difficulty)}
- ${toneInstruction(opts.tone)}

Output JSON shape:
{
  "title": "string",
  "summary": "string",
  "questions": [
    {
      "text": "string",
      "question_type": "multiple_choice",
      "time_limit": 20,
      "points": 1000,
      "confidence": "high",
      "difficulty": "medium",
      "rationale": "string",
      "explanation": "2-3 sentence explanation that teaches the concept",
      "answers": [
        { "text": "string", "is_correct": true },
        { "text": "string", "is_correct": false },
        { "text": "string", "is_correct": false },
        { "text": "string", "is_correct": false }
      ],
      "citations": [
        { "source_label": "${options.sourceLabel}", "snippet": "exact source quote" }
      ]
    }
  ]
}

Source title: ${options.sourceTitle || "Untitled source"}
Source label: ${options.sourceLabel}
${isTopicMode ? "Topic" : "Source text"}:
${options.sourceText}
`.trim();
}

/**
 * Build a prompt for enriching existing questions with explanations and difficulty tags.
 */
export function buildEnrichmentPrompt(options: {
  questions: Array<{ text: string; answers: Array<{ text: string; is_correct: boolean }> }>;
  sourceText?: string;
}) {
  const questionsJson = JSON.stringify(
    options.questions.map((q) => ({
      text: q.text,
      answers: q.answers.map((a) => ({ text: a.text, is_correct: a.is_correct })),
    })),
    null,
    2
  );

  return `
You are enriching existing quiz questions with educational metadata.

For each question, provide:
1. A clear explanation (2-3 sentences) that teaches the concept — shown to students after they answer
2. A difficulty level (easy, medium, hard)
3. A confidence rating (high, medium, low) based on how unambiguous the question is

${options.sourceText ? `Use the source material to ground your explanations:\n${options.sourceText.slice(0, 12000)}\n\n` : ""}
Questions to enrich:
${questionsJson}

Return valid JSON with this shape:
{
  "enrichments": [
    {
      "explanation": "2-3 sentence explanation",
      "difficulty": "medium",
      "confidence": "high"
    }
  ]
}
The enrichments array must have exactly the same number of items as the input questions, in the same order.
`.trim();
}

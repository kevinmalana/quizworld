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

  const questions = rawQuestions.map((question, index) => {
    if (!question || typeof question !== "object") {
      throw new Error(`Question ${index + 1} is malformed.`);
    }

    const q = question as Record<string, unknown>;
    const text = typeof q.text === "string" ? q.text.trim() : "";
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

    if (!text) {
      throw new Error(`Question ${index + 1} is missing text.`);
    }

    // True/false must have exactly 2 answers; MC must have 4
    const expectedAnswers = questionType === "true_false" ? 2 : 4;
    if (rawAnswers.length < 2 || rawAnswers.length > 4) {
      throw new Error(`Question ${index + 1} must have between two and four answers.`);
    }

    const answers = rawAnswers.map((answer, answerIndex) => {
      if (!answer || typeof answer !== "object") {
        throw new Error(`Question ${index + 1}, answer ${answerIndex + 1} is malformed.`);
      }

      const a = answer as Record<string, unknown>;
      const answerText = typeof a.text === "string" ? a.text.trim() : "";
      const isCorrect = Boolean(a.is_correct);

      if (!answerText) {
        throw new Error(`Question ${index + 1}, answer ${answerIndex + 1} is blank.`);
      }

      return {
        text: answerText,
        is_correct: isCorrect,
      };
    });

    if (answers.filter((answer) => answer.is_correct).length !== 1) {
      throw new Error(`Question ${index + 1} must have exactly one correct answer.`);
    }

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

    return {
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
    };
  });

  return {
    title,
    summary,
    questions,
  };
}

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

export function buildAIQuizPrompt(options: {
  sourceTitle: string;
  sourceLabel: string;
  sourceText: string;
  questionCount: number;
  difficultyMix?: { easy: number; medium: number; hard: number };
}) {
  const { easy = 0, medium = 0, hard = 0 } = options.difficultyMix ?? {};
  const difficultyInstruction =
    easy + medium + hard > 0
      ? `\n- Difficulty distribution: ${easy} easy, ${medium} medium, ${hard} hard questions.`
      : `\n- Mix difficulties: roughly 30% easy, 50% medium, 20% hard.`;

  return `
You are generating a quiz draft from source material. Generate a mix of multiple-choice and true/false questions.

Requirements:
- Return valid JSON only.
- Generate exactly ${options.questionCount} questions.
- Every question must be answerable from the provided source text.
- Mix question types: about 70% multiple_choice and 30% true_false.
- For multiple_choice: exactly 4 answer choices.
- For true_false: exactly 2 answer choices (True / False).
- Exactly one answer must be correct per question.
- Avoid trivial wording copied directly from the source.
- Include a short rationale for the correct answer.
- Include a clear explanation (2-3 sentences) that teaches the concept. This will be shown to students after they answer.
- Include 1 to 2 citations per question.
- Each citation must quote a short exact snippet from the source text that supports the answer.
- Use time_limit values of 10, 20, 30, or 60.
- Use points values of 500 (easy), 1000 (medium), or 2000 (hard).
- Confidence must be one of: high, medium, low.
- Difficulty must be one of: easy, medium, hard.
- If the source is weak or ambiguous, reduce confidence and keep the question conservative.${difficultyInstruction}

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
    },
    {
      "text": "True or false: ...",
      "question_type": "true_false",
      "time_limit": 10,
      "points": 500,
      "confidence": "high",
      "difficulty": "easy",
      "rationale": "string",
      "explanation": "2-3 sentence explanation",
      "answers": [
        { "text": "True", "is_correct": true },
        { "text": "False", "is_correct": false }
      ],
      "citations": [
        { "source_label": "${options.sourceLabel}", "snippet": "exact source quote" }
      ]
    }
  ]
}

Source title: ${options.sourceTitle || "Untitled source"}
Source label: ${options.sourceLabel}
Source text:
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

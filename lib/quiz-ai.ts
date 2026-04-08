import { uid, type Question } from "@/lib/store";

export type AIQuestionCitation = {
  snippet: string;
  source_label: string;
};

export type AIQuestionDraft = {
  text: string;
  time_limit: number;
  points: number;
  confidence: "high" | "medium" | "low";
  rationale: string;
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
    const timeLimit = typeof q.time_limit === "number" ? q.time_limit : 20;
    const points = typeof q.points === "number" ? q.points : 1000;
    const confidence: AIQuestionDraft["confidence"] =
      q.confidence === "high" || q.confidence === "medium" || q.confidence === "low"
        ? q.confidence
        : "medium";
    const rationale = typeof q.rationale === "string" ? q.rationale.trim() : "";
    const rawAnswers = Array.isArray(q.answers) ? q.answers : [];
    const rawCitations = Array.isArray(q.citations) ? q.citations : [];

    if (!text) {
      throw new Error(`Question ${index + 1} is missing text.`);
    }

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
      time_limit: normalizeTimeLimit(timeLimit),
      points: normalizePoints(points),
      confidence,
      rationale,
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
}) {
  return `
You are generating a multiple-choice quiz draft from source material.

Requirements:
- Return valid JSON only.
- Generate exactly ${options.questionCount} questions.
- Every question must be answerable from the provided source text.
- Each question must have 4 answer choices.
- Exactly one answer must be correct.
- Avoid trivial wording copied directly from the source.
- Include a short rationale for the correct answer.
- Include 1 to 2 citations per question.
- Each citation must quote a short exact snippet from the source text that supports the answer.
- Use time_limit values of 10, 20, 30, or 60.
- Use points values of 500, 1000, or 2000.
- Confidence must be one of: high, medium, low.
- If the source is weak or ambiguous, reduce confidence and keep the question conservative.

Output JSON shape:
{
  "title": "string",
  "summary": "string",
  "questions": [
    {
      "text": "string",
      "time_limit": 20,
      "points": 1000,
      "confidence": "high",
      "rationale": "string",
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
Source text:
${options.sourceText}
`.trim();
}

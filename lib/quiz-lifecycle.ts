import type { QuestionData } from "@/components/builder/QuestionCard";

export type QuizLifecycleIntent =
  | { kind: "new" }
  | { kind: "draft"; id: string }
  | { kind: "edit"; id: string }
  | { kind: "duplicate"; id: string }
  | { kind: "version"; id: string };

export type RecoverableDraft = {
  title: string;
  category: string;
  emoji: string;
  isPublic: boolean;
  sourceType: string;
  questions: QuestionData[];
};

type DraftFingerprintInput = RecoverableDraft & {
  editingQuizId: string | null;
};

type DraftSaveInput = RecoverableDraft & {
  draftId: string | null;
  quizId: string | null;
  color: string;
  expectedRevision: number | null;
};

type SearchParamsLike = {
  get(name: string): string | null;
};

export function getQuizLifecycleIntent(searchParams: SearchParamsLike): QuizLifecycleIntent {
  const draftId = searchParams.get("draft")?.trim();
  if (draftId) return { kind: "draft", id: draftId };

  const quizId = searchParams.get("quiz")?.trim();
  if (quizId) {
    return searchParams.get("duplicate") === "1"
      ? { kind: "duplicate", id: quizId }
      : { kind: "edit", id: quizId };
  }

  const versionId = searchParams.get("version")?.trim();
  if (versionId) return { kind: "version", id: versionId };
  return { kind: "new" };
}

export function getLifecycleHref(intent: QuizLifecycleIntent): string {
  switch (intent.kind) {
    case "draft":
      return getDraftContinueHref(intent.id);
    case "edit":
      return `/create?quiz=${encodeURIComponent(intent.id)}`;
    case "duplicate":
      return `/create?quiz=${encodeURIComponent(intent.id)}&duplicate=1`;
    case "version":
      return `/create?version=${encodeURIComponent(intent.id)}`;
    case "new":
      return "/create";
  }
}

export function getDraftContinueHref(draftId: string): string {
  return `/create?draft=${encodeURIComponent(draftId)}`;
}

export function normalizePublishResult(
  data: unknown,
  editingQuizId: string | null,
): {
  quizId: string;
  versionNumber: number | null;
  lifecycle: "created" | "updated";
} {
  if (!editingQuizId) {
    if (typeof data !== "string" || !data) {
      throw new Error("Publish did not return a quiz id.");
    }
    return { quizId: data, versionNumber: null, lifecycle: "created" };
  }

  if (!data || typeof data !== "object") {
    throw new Error("Republish did not return quiz metadata.");
  }
  const value = data as Record<string, unknown>;
  if (typeof value.quiz_id !== "string" || !value.quiz_id) {
    throw new Error("Republish did not return a quiz id.");
  }
  return {
    quizId: value.quiz_id,
    versionNumber:
      typeof value.version_number === "number" ? value.version_number : null,
    lifecycle: "updated",
  };
}

export function buildDraftFingerprint(input: DraftFingerprintInput): string {
  return JSON.stringify({
    title: input.title.trim(),
    category: input.category,
    emoji: input.emoji,
    isPublic: input.isPublic,
    sourceType: input.sourceType,
    editingQuizId: input.editingQuizId,
    questions: input.questions.map((question) => ({
      text: question.text.trim(),
      type: question.type,
      imageUrl: question.imageUrl || "",
      videoUrl: question.videoUrl || "",
      shuffleAnswers: question.shuffleAnswers ?? false,
      timeLimit: question.timeLimit,
      points: question.points,
      explanation: question.explanation || "",
      aiMetadata: question.aiMetadata ?? null,
      answers: question.answers.map((answer) => ({
        text: answer.text.trim(),
        imageUrl: answer.imageUrl || "",
        isCorrect: answer.isCorrect,
      })),
    })),
  });
}

export function buildDraftSavePayload(input: DraftSaveInput) {
  return {
    p_draft_id: input.draftId,
    p_expected_revision: input.expectedRevision,
    p_quiz_id: input.quizId,
    p_title: input.title,
    p_category: input.category,
    p_emoji: input.emoji,
    p_color: input.color,
    p_is_public: input.isPublic,
    p_source_type: input.sourceType,
    p_questions: input.questions.map((question, questionIndex) => ({
      text: question.text,
      image_url: question.imageUrl || null,
      video_url: question.videoUrl || null,
      shuffle_answers: question.shuffleAnswers ?? false,
      time_limit: question.timeLimit,
      points: question.points,
      order_index: questionIndex,
      question_type: question.type || "multiple_choice",
      explanation: question.explanation || null,
      ai_metadata: question.aiMetadata ?? {},
      answers: question.answers.map((answer, answerIndex) => ({
        text: answer.text,
        image_url: answer.imageUrl || null,
        is_correct: answer.isCorrect,
        order_index: answerIndex,
      })),
    })),
  };
}

export function recoverLocalDraft(raw: string | null): RecoverableDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!Array.isArray(value.questions) || value.questions.length === 0) return null;
    if (!value.questions.every(isRecoverableQuestion)) return null;
    return {
      title: typeof value.title === "string" ? value.title : "",
      category: typeof value.category === "string" ? value.category : "General Knowledge",
      emoji: typeof value.emoji === "string" ? value.emoji : "💡",
      isPublic: typeof value.isPublic === "boolean" ? value.isPublic : true,
      sourceType: typeof value.sourceType === "string" ? value.sourceType : "manual",
      questions: value.questions as QuestionData[],
    };
  } catch {
    return null;
  }
}

function isRecoverableQuestion(value: unknown): value is QuestionData {
  if (!value || typeof value !== "object") return false;
  const question = value as Record<string, unknown>;
  return (
    typeof question.id === "string" &&
    typeof question.text === "string" &&
    typeof question.type === "string" &&
    typeof question.timeLimit === "number" &&
    typeof question.points === "number" &&
    Array.isArray(question.answers) &&
    question.answers.length >= 2 &&
    question.answers.every((answer) => {
      if (!answer || typeof answer !== "object") return false;
      const candidate = answer as Record<string, unknown>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.text === "string" &&
        typeof candidate.isCorrect === "boolean"
      );
    })
  );
}

import type { AIQuizDraft } from "@/lib/quiz-ai";
import { uid } from "@/lib/shared";
import type { QuestionData } from "@/components/builder/QuestionCard";

export function makeBlankQuestion(): QuestionData {
  return {
    id: uid(),
    text: "",
    type: "multiple_choice",
    timeLimit: 20,
    points: 1000,
    answers: [
      { id: uid(), text: "", isCorrect: true },
      { id: uid(), text: "", isCorrect: false },
      { id: uid(), text: "", isCorrect: false },
      { id: uid(), text: "", isCorrect: false },
    ],
  };
}

export function makeTrueFalseQuestion(): QuestionData {
  return {
    id: uid(),
    text: "",
    type: "true_false",
    timeLimit: 10,
    points: 500,
    answers: [
      { id: uid(), text: "True", isCorrect: true },
      { id: uid(), text: "False", isCorrect: false },
    ],
  };
}

export function isQuestionComplete(question: QuestionData): boolean {
  if (!question.text.trim()) return false;
  if (question.answers.length < 2) return false;
  if (question.answers.some((answer) => !answer.text.trim())) return false;
  if (
    question.type !== "poll" &&
    question.answers.filter((answer) => answer.isCorrect && answer.text.trim()).length !== 1
  ) {
    return false;
  }
  return true;
}

export function canPublishQuiz(title: string, questions: QuestionData[]): boolean {
  return Boolean(title.trim()) && questions.length > 0 && questions.every(isQuestionComplete);
}

export function questionsToPublishPayload(questions: QuestionData[]) {
  return questions.map((question) => ({
    text: question.text.trim(),
    image_url: question.imageUrl || "",
    video_url: question.videoUrl || "",
    shuffle_answers: question.shuffleAnswers ?? false,
    time_limit: question.timeLimit,
    points: question.points,
    question_type: question.type || "multiple_choice",
    explanation: question.explanation || "",
    ai_metadata: question.aiMetadata ?? {},
    answers: question.answers.map((answer) => ({
      text: answer.text.trim(),
      image_url: answer.imageUrl || "",
      is_correct: answer.isCorrect,
    })),
  }));
}

type LegacyQuestion = {
  id?: string;
  text?: string;
  timeLimit?: number;
  time_limit?: number;
  points?: number;
  answers?: {
    id?: string;
    text?: string;
    isCorrect?: boolean;
    is_correct?: boolean;
  }[];
};

export function legacyToQuestionData(question: LegacyQuestion): QuestionData {
  return {
    id: question.id || uid(),
    text: question.text || "",
    type: "multiple_choice",
    timeLimit: question.timeLimit || question.time_limit || 20,
    points: question.points || 1000,
    answers: (question.answers || []).map((answer) => ({
      id: answer.id || uid(),
      text: answer.text || "",
      isCorrect: answer.isCorrect ?? answer.is_correct ?? false,
    })),
  };
}

export function aiDraftToQuestionData(draft: AIQuizDraft): QuestionData[] {
  return draft.questions.map((question) => ({
    id: uid(),
    text: question.text,
    type: question.question_type === "true_false" ? "true_false" : "multiple_choice",
    timeLimit: question.time_limit,
    points: question.points,
    explanation: question.explanation || "",
    aiMetadata: {
      confidence: question.confidence,
      difficulty: question.difficulty,
      rationale: question.rationale,
      citations: question.citations,
    },
    answers: question.answers.map((answer) => ({
      id: uid(),
      text: answer.text,
      isCorrect: answer.is_correct,
    })),
  }));
}

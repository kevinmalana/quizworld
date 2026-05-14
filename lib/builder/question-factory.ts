import type { AIQuizDraft } from "@/lib/quiz-ai";
import { uid } from "@/lib/store";
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
  const filled = question.answers.filter((answer) => answer.text.trim());
  if (filled.length < 2) return false;
  if (
    question.type !== "poll" &&
    question.answers.filter((answer) => answer.isCorrect && answer.text.trim()).length !== 1
  ) {
    return false;
  }
  return true;
}

export function questionsToPublishPayload(questions: QuestionData[]) {
  return questions.map((question) => ({
    text: question.text,
    image_url: question.imageUrl || "",
    video_url: question.videoUrl || "",
    time_limit: question.timeLimit,
    points: question.points,
    question_type: question.type || "multiple_choice",
    explanation: question.explanation || "",
    answers: question.answers.map((answer) => ({
      text: answer.text,
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
    answers: question.answers.map((answer) => ({
      id: uid(),
      text: answer.text,
      isCorrect: answer.is_correct,
    })),
  }));
}

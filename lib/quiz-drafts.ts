import type { Question } from "@/lib/shared";

export type QuizDraftRow = {
  id: string;
  quiz_id: string | null;
  title: string;
  category: string;
  emoji: string | null;
  color: string | null;
  is_public: boolean;
  source_type: string;
  updated_at: string;
};

export type QuizDraftQuestionRow = {
  id: string;
  draft_id: string;
  text: string;
  time_limit: number;
  points: number;
  order_index: number;
};

export type QuizDraftAnswerRow = {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  order_index: number;
};

export type PublishedQuizRow = {
  id: string;
  title: string;
  category: string;
  emoji: string | null;
  color: string | null;
  is_public: boolean;
  questions?: Array<{
    id: string;
    text: string;
    time_limit: number;
    points: number;
    order_index: number;
    answers?: Array<{
      id: string;
      text: string;
      is_correct: boolean;
    }>;
  }>;
};

export type QuizVersionRow = {
  id: string;
  quiz_id: string;
  creator_id: string;
  version_number: number;
  title: string;
  category: string;
  emoji: string | null;
  color: string | null;
  is_public: boolean;
  snapshot: {
    title?: string;
    category?: string;
    emoji?: string | null;
    color?: string | null;
    is_public?: boolean;
    questions?: Array<{
      text?: string;
      time_limit?: number;
      points?: number;
      answers?: Array<{
        text?: string;
        is_correct?: boolean;
      }>;
    }>;
  };
  created_at: string;
};

export function questionsFromDraftRows(
  draftQuestions: QuizDraftQuestionRow[],
  draftAnswers: QuizDraftAnswerRow[]
): Question[] {
  return [...draftQuestions]
    .sort((a, b) => a.order_index - b.order_index)
    .map((question) => ({
      id: question.id,
      text: question.text,
      timeLimit: question.time_limit,
      points: question.points,
      answers: draftAnswers
        .filter((answer) => answer.question_id === question.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map((answer) => ({
          id: answer.id,
          text: answer.text,
          isCorrect: answer.is_correct,
        })),
    }));
}

export function questionsFromPublishedQuiz(quiz: PublishedQuizRow): Question[] {
  return [...(quiz.questions ?? [])]
    .sort((a, b) => a.order_index - b.order_index)
    .map((question) => ({
      id: question.id,
      text: question.text,
      timeLimit: question.time_limit,
      points: question.points,
      answers: [...(question.answers ?? [])].map((answer) => ({
        id: answer.id,
        text: answer.text,
        isCorrect: answer.is_correct,
      })),
    }));
}

export function questionsFromVersionSnapshot(version: QuizVersionRow): Question[] {
  return [...(version.snapshot.questions ?? [])].map((question, questionIndex) => ({
    id: `version-question-${version.id}-${questionIndex}`,
    text: question.text ?? "",
    timeLimit: question.time_limit ?? 20,
    points: question.points ?? 1000,
    answers: [...(question.answers ?? [])].map((answer, answerIndex) => ({
      id: `version-answer-${version.id}-${questionIndex}-${answerIndex}`,
      text: answer.text ?? "",
      isCorrect: Boolean(answer.is_correct),
    })),
  }));
}

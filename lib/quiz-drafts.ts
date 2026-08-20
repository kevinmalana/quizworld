export type PersistedQuestionType = "multiple_choice" | "true_false" | "poll";

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
  revision: number;
};

export type QuizDraftQuestionRow = {
  id: string;
  draft_id: string;
  text: string;
  image_url: string | null;
  time_limit: number;
  points: number;
  order_index: number;
  question_type: PersistedQuestionType;
  explanation: string | null;
  video_url: string | null;
  shuffle_answers: boolean;
};

export type QuizDraftAnswerRow = {
  id: string;
  question_id: string;
  text: string;
  image_url: string | null;
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
    image_url: string | null;
    time_limit: number;
    points: number;
    order_index: number;
    question_type: PersistedQuestionType;
    explanation: string | null;
    video_url: string | null;
    shuffle_answers: boolean;
    answers?: Array<{
      id: string;
      text: string;
      image_url: string | null;
      is_correct: boolean;
      order_index: number;
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
      image_url?: string | null;
      time_limit?: number;
      points?: number;
      question_type?: PersistedQuestionType;
      explanation?: string | null;
      video_url?: string | null;
      shuffle_answers?: boolean;
      answers?: Array<{
        text?: string;
        image_url?: string | null;
        is_correct?: boolean;
      }>;
    }>;
  };
  created_at: string;
};

export function questionsFromDraftRows(
  draftQuestions: QuizDraftQuestionRow[],
  draftAnswers: QuizDraftAnswerRow[]
) {
  return [...draftQuestions]
    .sort((a, b) => a.order_index - b.order_index)
    .map((question) => ({
      id: question.id,
      text: question.text,
      imageUrl: question.image_url ?? "",
      type: question.question_type,
      timeLimit: question.time_limit,
      points: question.points,
      explanation: question.explanation ?? "",
      videoUrl: question.video_url ?? "",
      shuffleAnswers: question.shuffle_answers ?? false,
      answers: draftAnswers
        .filter((answer) => answer.question_id === question.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map((answer) => ({
          id: answer.id,
          text: answer.text,
          imageUrl: answer.image_url ?? "",
          isCorrect: answer.is_correct,
        })),
    }));
}

export function questionsFromPublishedQuiz(quiz: PublishedQuizRow) {
  return [...(quiz.questions ?? [])]
    .sort((a, b) => a.order_index - b.order_index)
    .map((question) => ({
      id: question.id,
      text: question.text,
      imageUrl: question.image_url ?? "",
      type: question.question_type,
      timeLimit: question.time_limit,
      points: question.points,
      explanation: question.explanation ?? "",
      videoUrl: question.video_url ?? "",
      shuffleAnswers: question.shuffle_answers ?? false,
      answers: [...(question.answers ?? [])]
        .sort((a, b) => a.order_index - b.order_index)
        .map((answer) => ({
          id: answer.id,
          text: answer.text,
          imageUrl: answer.image_url ?? "",
          isCorrect: answer.is_correct,
        })),
    }));
}

export function questionsFromVersionSnapshot(version: QuizVersionRow) {
  return [...(version.snapshot.questions ?? [])].map((question, questionIndex) => ({
    id: `version-question-${version.id}-${questionIndex}`,
    text: question.text ?? "",
    imageUrl: question.image_url ?? "",
    type: question.question_type ?? "multiple_choice" as const,
    timeLimit: question.time_limit ?? 20,
    points: question.points ?? 1000,
    explanation: question.explanation ?? "",
    videoUrl: question.video_url ?? "",
    shuffleAnswers: question.shuffle_answers ?? false,
    answers: [...(question.answers ?? [])].map((answer, answerIndex) => ({
      id: `version-answer-${version.id}-${questionIndex}-${answerIndex}`,
      text: answer.text ?? "",
      imageUrl: answer.image_url ?? "",
      isCorrect: Boolean(answer.is_correct),
    })),
  }));
}

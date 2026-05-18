export type GameStatus = "waiting" | "active" | "reveal" | "finished";

export type GamePlayer = {
  id: string;
  nickname: string;
  avatar?: string;
  score?: number;
};

export type GameAnswer = {
  id: string;
  text: string;
  is_correct?: boolean;
  image_url?: string | null;
};

export type GameQuestion = {
  id: string;
  text: string;
  order_index?: number;
  time_limit?: number;
  image_url?: string | null;
  video_url?: string | null;
  answers?: GameAnswer[];
};

export type CurrentAnswer = {
  player_id: string;
  answer_id: string;
  is_correct?: boolean;
  points_awarded?: number;
  response_time_ms?: number;
};

export type QuestionHistoryEntry = {
  index: number;
  text: string;
  correct_answer_text?: string;
  responses?: {
    player_id: string;
    nickname: string;
    avatar?: string;
    is_correct: boolean;
    points_awarded: number;
    response_time_ms: number;
  }[];
};

export type PhoenixSessionSnapshot = Record<string, unknown> & {
  quiz?: { questions?: GameQuestion[] };
  current_question?: GameQuestion | null;
  current_answers?: CurrentAnswer[];
  question_history?: QuestionHistoryEntry[];
  // Game mode extensions
  game_mode?: "classic" | "survival" | "team";
  eliminated?: string[];       // survival: list of eliminated player_ids
  alive_count?: number;        // survival: players still in
  teams?: Record<string, { id: string; name: string; color: string; emoji: string; score: number }>;
  team_assignments?: Record<string, string>; // player_id → team_id
};

export function sortQuestions<T extends { order_index?: number }>(questions: T[] = []) {
  return [...questions].sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0));
}

export function sortQuizQuestions(quiz: unknown) {
  const q = quiz as { questions?: { order_index?: number }[] } | null;
  if (!q?.questions) return quiz;

  return {
    ...(q as object),
    questions: sortQuestions(q.questions),
  };
}

export function getTimeLeft(question: { time_limit?: number } | null, startedAt: string | null) {
  if (!question) return 0;

  const total = question.time_limit ?? 20;
  if (!startedAt) return 0;

  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  return Math.max(total - elapsed, 0);
}

export function normalizePhoenixSession(rawSession: Record<string, unknown>): PhoenixSessionSnapshot {
  const quiz = (rawSession?.quiz as { questions?: GameQuestion[] }) ?? {};
  const questions = sortQuestions(quiz.questions ?? []);
  const currentQuestion =
    (rawSession?.current_question as GameQuestion | null) ??
    questions[(rawSession?.current_question_index as number) ?? 0] ??
    null;

  return {
    ...rawSession,
    quiz: {
      ...quiz,
      questions,
    },
    current_question: currentQuestion,
    current_answers: (rawSession?.current_answers as CurrentAnswer[]) ?? [],
    question_history: (rawSession?.question_history as QuestionHistoryEntry[]) ?? [],
  };
}

export type StudyMode = "choose" | "flashcard" | "quickfire" | "review";
export type CardState = "front" | "back";
export type SessionResult = {
  correct: number;
  total: number;
  wrongQuestions: StudyQuestion[];
};

export type StudyAnswer = {
  id: string;
  text: string;
  image_url?: string | null;
  is_correct: boolean;
};

export type StudyQuestion = {
  id: string;
  text: string;
  image_url?: string | null;
  time_limit?: number | null;
  explanation?: string | null;
  difficulty?: string | null;
  answers?: StudyAnswer[];
};

export type StudyQuiz = {
  id: string;
  title: string;
  questions?: StudyQuestion[];
};

export type StudyMode = "choose" | "flashcard" | "quickfire";
export type CardState = "front" | "back";
export type SessionResult = { correct: number; total: number };

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
  answers?: StudyAnswer[];
};

export type StudyQuiz = {
  id: string;
  title: string;
  questions?: StudyQuestion[];
};

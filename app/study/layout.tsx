import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Study Hall",
  description: "Study with flashcards and quizzes on QuizWorld. Master any topic with interactive learning.",
};

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return children;
}

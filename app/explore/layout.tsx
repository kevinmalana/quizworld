import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Quizzes",
  description: "Browse public quizzes on QuizWorld. Find trivia, science, history, and more. Host a live game or study at your own pace.",
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}

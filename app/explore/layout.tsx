import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Quizzes",
  description: "Browse and search thousands of public quiz sets on QuizWorld. Filter by category, difficulty, or topic.",
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

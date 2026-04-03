import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create a Quiz",
  description: "Create a new quiz from scratch, paste questions, or generate with AI. Build multiplayer quiz experiences in minutes.",
  keywords: ["create quiz", "quiz maker", "AI quiz generator", "build quiz", "quiz builder"],
  openGraph: {
    title: "Create a Quiz | QuizWorld",
    description: "Build multiplayer quiz experiences. AI-powered question generation.",
    images: ["/og-image.png"],
  },
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

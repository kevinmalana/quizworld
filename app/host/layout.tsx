import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Host a Quiz",
  description: "Host a live multiplayer quiz session on QuizWorld. Enter a PIN, manage questions, and see live scores. Perfect for classrooms, parties, and team building.",
  keywords: ["host quiz", "live quiz", "multiplayer quiz", "quiz PIN", "classroom quiz", "team quiz"],
  openGraph: {
    title: "Host a Quiz | QuizWorld",
    description: "Host live quiz sessions. Real-time multiplayer with live scoring.",
    images: ["/og-image.png"],
  },
};

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

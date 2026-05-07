import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join Game",
  description: "Join a live QuizWorld game. Enter your PIN and start playing!",
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}

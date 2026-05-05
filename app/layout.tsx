import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { AuthProvider } from "@/components/supabase-provider";

export const metadata: Metadata = {
  title: "QuizWorld — Live Quizzes That Feel Like Game Night",
  description: "Host live quiz sessions, join games with friends, or study with AI-powered quizzes. Play anytime, anywhere.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <Navigation />
          <main style={{ paddingTop: "var(--nav-height)" }}>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}

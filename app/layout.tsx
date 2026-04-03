import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { AuthProvider } from "@/components/supabase-provider";

export const metadata: Metadata = {
  title: {
    default: "QuizWorld — Live Quizzes That Feel Like Game Night",
    template: "%s | QuizWorld",
  },
  description: "Host live quiz sessions, join games with friends, or study with AI-powered quizzes. Create quizzes from any topic using AI. Free, instant, multiplayer.",
  keywords: ["quiz", "AI quiz", "online quiz", "multiplayer quiz", "study", "trivia", "game night", "live quiz", "quiz generator", "artificial intelligence quiz"],
  authors: [{ name: "Kevin Malana", url: "https://github.com/kevinmalana" }],
  creator: "Kevin Malana",
  metadataBase: new URL("https://quizworld.xyz"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://quizworld.xyz",
    siteName: "QuizWorld",
    title: "QuizWorld — Live Quizzes That Feel Like Game Night",
    description: "Host live quiz sessions, join games with friends, or study with AI-powered quizzes. Create quizzes from any topic using AI.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "QuizWorld — AI-Powered Live Quizzes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QuizWorld — Live Quizzes That Feel Like Game Night",
    description: "Host live quiz sessions, join games with friends, or study with AI-powered quizzes. Create quizzes from any topic using AI.",
    images: ["/og-image.png"],
    creator: "@kevinonchain",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "GOOGLE_SITE_VERIFICATION_TOKEN", // Replace with actual token when available
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧠</text></svg>" />
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
        </AuthProvider>    </body>
    </html>
  );
}

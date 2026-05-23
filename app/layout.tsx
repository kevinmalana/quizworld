import type { Metadata } from "next";
import "./globals.css";
import "../styles/game.css";
import "../styles/present.css";
import "../styles/explore.css";
import "../styles/report.css";
import "../styles/home.css";
import "../styles/profile.css";
import "../styles/builder.css";
import "../styles/study.css";
import "../styles/dashboard.css";
import "../styles/groups.css";
import "../styles/leaderboard.css";
import "../styles/achievements.css";
import "../styles/friends.css";
import { Navigation } from "@/components/navigation";
import { AuthProvider } from "@/components/supabase-provider";
import { ErrorBoundary } from "@/components/error-boundary";

export const metadata: Metadata = {
  title: {
    default: "QuizWorld — Live Quizzes That Feel Like Game Night",
    template: "%s | QuizWorld",
  },
  description: "Host live quiz sessions, join games with friends, or study with AI-powered quizzes. Play anytime, anywhere.",
  metadataBase: new URL("https://www.quizworld.xyz"),
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.quizworld.xyz",
    siteName: "QuizWorld",
    title: "QuizWorld — Live Quizzes That Feel Like Game Night",
    description: "Host live quiz sessions, join games with friends, or study with AI-powered quizzes.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "QuizWorld",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QuizWorld — Live Quizzes That Feel Like Game Night",
    description: "Host live quiz sessions, join games with friends, or study with AI-powered quizzes.",
    images: ["/og-image.png"],
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
          <main className="app-shell">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
          <footer style={{
            borderTop: "1px solid var(--line)",
            padding: "1.5rem 1rem",
            textAlign: "center",
            fontSize: "0.8125rem",
            color: "var(--muted)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: "0.25rem 1.25rem",
          }}>
            <span>© {new Date().getFullYear()} QuizWorld</span>
            <a href="/terms" style={{ color: "var(--muted)", textDecoration: "none" }}>Terms of Service</a>
            <a href="/privacy" style={{ color: "var(--muted)", textDecoration: "none" }}>Privacy Policy</a>
            <a href="mailto:support@quizworld.xyz" style={{ color: "var(--muted)", textDecoration: "none" }}>Contact</a>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}

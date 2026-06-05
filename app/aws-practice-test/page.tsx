import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Free AWS Practice Tests — SAA-C03, CLF-C02, ANS-C01 | QuizWorld",
  description:
    "Practice for AWS certification exams with free mock tests on QuizWorld. SAA-C03, CLF-C02, Developer, SysOps, and more. Play solo or compete live with others.",
  alternates: { canonical: "https://www.quizworld.xyz/aws-practice-test" },
  openGraph: {
    title: "Free AWS Practice Tests — SAA-C03, CLF-C02, ANS-C01 | QuizWorld",
    description:
      "Practice for AWS certification exams with free mock tests on QuizWorld. SAA-C03, CLF-C02, Developer, SysOps, and more.",
    url: "https://www.quizworld.xyz/aws-practice-test",
    type: "website",
  },
};

const AWS_EXAMS = [
  {
    code: "SAA-C03",
    name: "AWS Solutions Architect – Associate",
    icon: "🏗️",
    description: "Core AWS services, architecture best practices, well-architected framework.",
  },
  {
    code: "CLF-C02",
    name: "AWS Cloud Practitioner",
    icon: "☁️",
    description: "Foundational cloud concepts, billing, security, and AWS core services.",
  },
  {
    code: "DVA-C02",
    name: "AWS Developer – Associate",
    icon: "👩‍💻",
    description: "Developing, deploying, and debugging cloud-based applications on AWS.",
  },
  {
    code: "SOA-C02",
    name: "AWS SysOps Administrator – Associate",
    icon: "🔧",
    description: "Deploying, managing, and operating workloads on AWS.",
  },
  {
    code: "ANS-C01",
    name: "AWS Advanced Networking – Specialty",
    icon: "🌐",
    description: "Designing and implementing complex networking solutions on AWS.",
  },
  {
    code: "SAP-C02",
    name: "AWS Solutions Architect – Professional",
    icon: "🧑‍🔬",
    description: "Advanced architectural design across complex, large-scale environments.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Free AWS Practice Tests",
  description:
    "Practice for AWS certification exams with free mock tests on QuizWorld. SAA-C03, CLF-C02, Developer, SysOps, and more.",
  url: "https://www.quizworld.xyz/aws-practice-test",
  provider: {
    "@type": "Organization",
    name: "QuizWorld",
    url: "https://www.quizworld.xyz",
  },
};

export default function AWSPracticeTestPage() {
  return (
    <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem", maxWidth: "860px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>☁️</div>
        <h1 className="font-display" style={{ fontSize: "2.25rem", marginBottom: "1rem" }}>
          Free AWS Practice Tests
        </h1>
        <p className="text-muted" style={{ fontSize: "1.1rem", maxWidth: "600px", margin: "0 auto 1.5rem" }}>
          Prepare for your AWS certification with free, community-created practice quizzes. Play solo
          or host a live study session with your team.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/explore/technology" className="btn btn-primary">
            🔍 Browse Technology Quizzes
          </Link>
          <Link href="/create" className="btn btn-secondary">
            ✨ Create Practice Test
          </Link>
        </div>
      </div>

      {/* Exam grid */}
      <h2 className="font-display" style={{ fontSize: "1.4rem", marginBottom: "1.25rem" }}>
        Popular AWS Certification Exams
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "1.25rem",
          marginBottom: "3rem",
        }}
      >
        {AWS_EXAMS.map((exam) => (
          <div key={exam.code} className="card">
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{exam.icon}</div>
            <div
              style={{
                display: "inline-block",
                background: "var(--primary-light)",
                color: "var(--primary)",
                padding: "0.2rem 0.6rem",
                borderRadius: "0.375rem",
                fontSize: "0.8125rem",
                fontWeight: 700,
                marginBottom: "0.5rem",
              }}
            >
              {exam.code}
            </div>
            <h3 className="font-display" style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
              {exam.name}
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
              {exam.description}
            </p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Link href="/explore/technology" className="btn btn-secondary btn-compact" style={{ flex: 1, textAlign: "center" }}>
                Browse Quizzes
              </Link>
              <Link href="/create" className="btn btn-primary btn-compact" style={{ flex: 1, textAlign: "center" }}>
                Create Test
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h2 className="font-display" style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
          Why QuizWorld for AWS Prep?
        </h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[
            ["🆓", "100% free — no paywalls, no limits"],
            ["🎮", "Play solo or host live multiplayer quiz sessions with your study group"],
            ["🤖", "AI-powered quiz generation — paste exam objectives, get practice questions instantly"],
            ["📊", "Track your progress, see where you need to improve"],
            ["📱", "Works on any device — phone, tablet, or desktop"],
          ].map(([icon, text]) => (
            <li key={text as string} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              <span style={{ fontSize: "1.25rem", flexShrink: 0 }}>{icon}</span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div
        style={{
          textAlign: "center",
          padding: "2.5rem",
          background: "linear-gradient(135deg, var(--primary-light) 0%, var(--surface) 100%)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--line)",
        }}
      >
        <h2 className="font-display" style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
          Ready to start practicing?
        </h2>
        <p className="text-muted" style={{ marginBottom: "1.5rem" }}>
          Join thousands of students using QuizWorld to ace their AWS exams.
        </p>
        <Link href="/create" className="btn btn-primary" style={{ fontSize: "1.05rem", padding: "0.75rem 2rem" }}>
          Create a Free Practice Test →
        </Link>
      </div>
    </div>
  );
}

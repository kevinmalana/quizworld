import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the QuizWorld team.",
};

export default function ContactPage() {
  return (
    <div className="container" style={{ maxWidth: 560, paddingTop: "3rem", paddingBottom: "5rem" }}>
      <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 900, marginBottom: "0.5rem" }}>
        Contact Us
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "2.5rem", lineHeight: 1.6 }}>
        Questions, bug reports, content removal requests, or just want to say hi — we&apos;re here.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2.5rem" }}>
        <ContactCard
          icon="📧"
          title="General Enquiries"
          detail="support@quizworld.xyz"
          href="mailto:support@quizworld.xyz"
          desc="Questions about your account, features, or the platform."
        />
        <ContactCard
          icon="⚖️"
          title="Legal & Privacy"
          detail="support@quizworld.xyz"
          href="mailto:support@quizworld.xyz?subject=Legal%20%2F%20Privacy%20Request"
          desc="Data deletion requests, GDPR/privacy enquiries, terms questions."
        />
        <ContactCard
          icon="🚩"
          title="Report Content"
          detail="support@quizworld.xyz"
          href="mailto:support@quizworld.xyz?subject=Content%20Report"
          desc="Report a quiz that contains harmful, offensive, or infringing content."
        />
        <ContactCard
          icon="🐛"
          title="Bug Reports"
          detail="support@quizworld.xyz"
          href="mailto:support@quizworld.xyz?subject=Bug%20Report"
          desc="Found something broken? Tell us what happened and we&apos;ll fix it."
        />
      </div>

      <div style={{
        padding: "1.25rem",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        fontSize: "0.875rem",
        color: "var(--muted)",
        lineHeight: 1.6,
      }}>
        <strong style={{ color: "var(--ink)" }}>Response time:</strong> We aim to respond within 2 business days (AEST).
        For urgent safety or legal matters, please mark your subject line accordingly.
      </div>

      <div style={{ marginTop: "2rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href="/terms" className="btn btn-secondary btn-compact">Terms of Service</Link>
        <Link href="/privacy" className="btn btn-secondary btn-compact">Privacy Policy</Link>
        <Link href="/" className="btn btn-secondary btn-compact">← Home</Link>
      </div>
    </div>
  );
}

function ContactCard({
  icon, title, detail, href, desc,
}: {
  icon: string; title: string; detail: string; href: string; desc: string;
}) {
  return (
    <a
      href={href}
      style={{ textDecoration: "none" }}
    >
      <div className="card card-hover" style={{ display: "flex", gap: "1rem", alignItems: "flex-start", padding: "1.1rem 1.25rem" }}>
        <span style={{ fontSize: "1.5rem", flexShrink: 0, marginTop: "0.1rem" }}>{icon}</span>
        <div>
          <div className="font-display" style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--ink)", marginBottom: "0.2rem" }}>
            {title}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--accent)", fontWeight: 600, marginBottom: "0.25rem" }}>
            {detail}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.5 }}>
            {desc}
          </div>
        </div>
      </div>
    </a>
  );
}

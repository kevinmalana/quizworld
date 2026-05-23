import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "QuizWorld Privacy Policy — how we collect, use, and protect your personal information.",
};

const LAST_UPDATED = "23 May 2026";

export default function PrivacyPage() {
  return (
    <div className="container" style={{ maxWidth: 760, paddingTop: "3rem", paddingBottom: "5rem" }}>
      <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 900, marginBottom: "0.25rem" }}>
        Privacy Policy
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "2.5rem" }}>
        Last updated: {LAST_UPDATED}
      </p>

      <Section title="1. Who We Are">
        <p>QuizWorld operates at <strong>quizworld.xyz</strong>. We are committed to protecting your personal information and being transparent about how we use it. This Privacy Policy explains what data we collect, why, and your rights over it.</p>
        <p>Contact: <strong>support@quizworld.xyz</strong></p>
      </Section>

      <Section title="2. What Data We Collect">
        <p><strong>Account data:</strong> When you create an account, we collect your email address and (optionally) a display name and avatar.</p>
        <p><strong>Google Sign-In:</strong> If you sign in with Google, we receive your name and email from Google. We do not receive your Google password.</p>
        <p><strong>Quiz content:</strong> Quizzes, questions, and answers you create are stored on our servers.</p>
        <p><strong>Game session data:</strong> Player nicknames, scores, and answers during live game sessions. This data is used to run the game and generate results.</p>
        <p><strong>Usage data:</strong> XP points, study progress, streak counts, and leaderboard position — used to power your profile and game features.</p>
        <p><strong>Technical data:</strong> Browser type, device type, and IP address collected automatically when you use the Platform. Used for security and performance monitoring only.</p>
      </Section>

      <Section title="3. How We Use Your Data">
        <ul>
          <li>To create and manage your account.</li>
          <li>To operate live game sessions and study features.</li>
          <li>To display your username, avatar, and level on leaderboards and quiz cards.</li>
          <li>To send transactional emails (e.g. account confirmation). We do not send marketing emails without your consent.</li>
          <li>To improve the Platform and fix bugs.</li>
          <li>To comply with legal obligations.</li>
        </ul>
        <p>We do not sell your personal data to third parties.</p>
      </Section>

      <Section title="4. How We Store Your Data">
        <p>Your data is stored securely using <strong>Supabase</strong> (supabase.com), a cloud database provider. Data is stored in a secure, access-controlled environment. Supabase processes data in accordance with GDPR and relevant international data protection standards.</p>
        <p>Game session data (player nicknames, in-game scores) is temporarily processed by our real-time game engine hosted on <strong>Render</strong> (render.com) and saved to our database after each game.</p>
      </Section>

      <Section title="5. Cookies">
        <p>We use essential cookies to keep you logged in and maintain your session. We do not use tracking or advertising cookies. You can disable cookies in your browser settings, but this may affect your ability to log in.</p>
      </Section>

      <Section title="6. Children&rsquo;s Privacy">
        <p>QuizWorld requires users to be at least 13 years old. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has created an account, please contact us at <strong>support@quizworld.xyz</strong> and we will delete the account promptly.</p>
        <p>For classroom use involving students under 18, teachers are responsible for ensuring appropriate consent has been obtained from parents or guardians.</p>
      </Section>

      <Section title="7. Sharing Your Data">
        <p>We only share your data in these circumstances:</p>
        <ul>
          <li><strong>Service providers:</strong> Supabase (database), Render (game engine), Vercel (website hosting). These providers process data only as needed to deliver the service.</li>
          <li><strong>Legal requirements:</strong> If required by law, court order, or to protect the safety of users or the public.</li>
          <li>We do not share your data with advertisers or data brokers.</li>
        </ul>
      </Section>

      <Section title="8. Your Rights">
        <p>Depending on where you are located, you may have the following rights:</p>
        <ul>
          <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
          <li><strong>Correction:</strong> Update or correct your data via your Profile settings.</li>
          <li><strong>Deletion:</strong> Delete your account and associated data from your Profile settings. We will process deletion within 30 days.</li>
          <li><strong>Portability:</strong> Request an export of your quiz content and game history.</li>
          <li><strong>Objection:</strong> Object to processing of your data in certain circumstances.</li>
        </ul>
        <p>To exercise any of these rights, email us at <strong>support@quizworld.xyz</strong>.</p>
      </Section>

      <Section title="9. Data Retention">
        <p>We retain your account data for as long as your account is active. If you delete your account, we remove your personal data within 30 days, except where we are required to retain it for legal or compliance reasons. Anonymised usage data (e.g. aggregated game statistics) may be retained indefinitely.</p>
      </Section>

      <Section title="10. International Transfers">
        <p>QuizWorld is based in Australia. Our service providers (Supabase, Vercel, Render) may process data in the United States and other countries. These providers maintain appropriate safeguards including Standard Contractual Clauses for transfers from the EU/UK.</p>
      </Section>

      <Section title="11. Australian Privacy Act">
        <p>We comply with the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs). If you are located in Australia and have a complaint about our handling of your personal information, you may contact the <strong>Office of the Australian Information Commissioner (OAIC)</strong> at oaic.gov.au.</p>
      </Section>

      <Section title="12. GDPR (EU &amp; UK Users)">
        <p>If you are located in the European Union or United Kingdom, you have additional rights under the General Data Protection Regulation (GDPR). Our legal basis for processing your data is:</p>
        <ul>
          <li><strong>Contract performance</strong> — to provide the QuizWorld service you signed up for.</li>
          <li><strong>Legitimate interests</strong> — to operate, improve, and secure the Platform.</li>
          <li><strong>Legal obligation</strong> — where required by law.</li>
        </ul>
        <p>You may lodge a complaint with your local data protection authority.</p>
      </Section>

      <Section title="13. Changes to This Policy">
        <p>We may update this Privacy Policy from time to time. Material changes will be communicated by posting a notice on the Platform or emailing your registered address. The &ldquo;Last updated&rdquo; date at the top reflects the most recent revision.</p>
      </Section>

      <Section title="14. Contact">
        <p>Privacy questions or requests: <strong>support@quizworld.xyz</strong></p>
      </Section>

      <div style={{ marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--line)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link href="/terms" className="btn btn-secondary btn-compact">Terms of Service →</Link>
        <Link href="/" className="btn btn-secondary btn-compact">← Back to QuizWorld</Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "2rem" }}>
      <h2 className="font-display" style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "0.75rem", color: "var(--ink)" }}>
        {title}
      </h2>
      <div style={{ fontSize: "0.9375rem", lineHeight: 1.7, color: "var(--text)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {children}
      </div>
    </section>
  );
}

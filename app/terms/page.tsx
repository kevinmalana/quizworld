import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "QuizWorld Terms of Service — your rights and responsibilities when using the platform.",
};

const LAST_UPDATED = "23 May 2026";

export default function TermsPage() {
  return (
    <div className="container" style={{ maxWidth: 760, paddingTop: "3rem", paddingBottom: "5rem" }}>
      <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 900, marginBottom: "0.25rem" }}>
        Terms of Service
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "2.5rem" }}>
        Last updated: {LAST_UPDATED}
      </p>

      <Section title="1. About QuizWorld">
        <p>QuizWorld (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is an online platform that lets users create, host, and play live quiz games. By accessing or using QuizWorld at <strong>quizworld.xyz</strong> (&ldquo;the Platform&rdquo;), you agree to these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, please do not use the Platform.</p>
      </Section>

      <Section title="2. Eligibility">
        <p>You must be at least <strong>13 years old</strong> to use QuizWorld. If you are under 18, you confirm that a parent or guardian has reviewed and agreed to these Terms on your behalf. If you are using QuizWorld as part of a school or classroom, your teacher or institution takes responsibility for appropriate use.</p>
      </Section>

      <Section title="3. Your Account">
        <ul>
          <li>You are responsible for keeping your account credentials secure.</li>
          <li>You must provide accurate information when creating an account.</li>
          <li>You may not share your account or use another person&rsquo;s account.</li>
          <li>You can delete your account at any time from your Profile settings. We will remove your personal data in accordance with our <Link href="/privacy">Privacy Policy</Link>.</li>
        </ul>
      </Section>

      <Section title="4. User-Generated Content">
        <p>You may create quizzes, questions, and answers (&ldquo;Content&rdquo;) on QuizWorld. By publishing Content, you:</p>
        <ul>
          <li>Confirm you own or have the right to use it.</li>
          <li>Grant QuizWorld a worldwide, non-exclusive, royalty-free licence to host, display, and make your Content available to other users.</li>
          <li>Confirm your Content does not infringe any third-party copyright, trademark, or other intellectual property right.</li>
          <li>Understand that public quizzes are visible to all users of the Platform.</li>
        </ul>
        <p>We reserve the right to remove Content that violates these Terms without notice.</p>
      </Section>

      <Section title="5. Acceptable Use">
        <p>You agree <strong>not</strong> to:</p>
        <ul>
          <li>Post Content that is hateful, discriminatory, harassing, defamatory, obscene, or illegal.</li>
          <li>Use offensive, impersonating, or inappropriate nicknames in game sessions.</li>
          <li>Attempt to reverse-engineer, scrape, or disrupt the Platform or its infrastructure.</li>
          <li>Use automated bots or scripts to join games or create accounts.</li>
          <li>Use the Platform to infringe copyright — including copying questions verbatim from third-party sources without permission.</li>
          <li>Sell, sublicence, or commercially exploit any part of the Platform without our written consent.</li>
        </ul>
      </Section>

      <Section title="6. Third-Party Content Attribution">
        <p>Some quizzes on QuizWorld include questions sourced from <strong>Open Trivia Database</strong> (opentdb.com), used under the <strong>Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)</strong> licence. These questions are attributed accordingly. If you believe any content infringes your rights, please contact us at <strong>support@quizworld.xyz</strong>.</p>
      </Section>

      <Section title="7. Game Sessions &amp; XP">
        <p>QuizWorld game sessions are powered by a real-time game engine. Player nicknames and scores are temporarily stored during sessions to operate the game. XP (experience points) and leaderboard scores are awarded for participation and study activity. <strong>XP and level badges have no monetary value</strong> and cannot be exchanged for cash, prizes, or any real-world benefit.</p>
      </Section>

      <Section title="8. Classroom Features">
        <p>Teachers and educators may use the classroom feature to organise students into groups. By creating a classroom, you confirm:</p>
        <ul>
          <li>You have the authority to add participants to the classroom.</li>
          <li>Any participants under 13 have obtained appropriate parental or guardian consent.</li>
          <li>You will use the classroom feature in compliance with applicable laws and your institution&rsquo;s policies.</li>
        </ul>
      </Section>

      <Section title="9. Intellectual Property">
        <p>The QuizWorld name, logo, and Platform design are our intellectual property. You may not copy, reproduce, or rebrand any part of the Platform without written permission. Your own quiz content remains yours — we do not claim ownership of Content you create.</p>
      </Section>

      <Section title="10. Disclaimers &amp; Limitation of Liability">
        <p>QuizWorld is provided <strong>&ldquo;as is&rdquo;</strong> without warranties of any kind. We do not guarantee uninterrupted access or that the Platform will be error-free. To the maximum extent permitted by law, QuizWorld is not liable for any indirect, incidental, or consequential damages arising from your use of the Platform, including loss of data or game session interruptions.</p>
      </Section>

      <Section title="11. Termination">
        <p>We may suspend or terminate your account if you breach these Terms, without prior notice. You may stop using QuizWorld at any time. Sections covering intellectual property, disclaimers, and limitation of liability survive termination.</p>
      </Section>

      <Section title="12. Changes to These Terms">
        <p>We may update these Terms from time to time. We will notify you of material changes by posting a notice on the Platform or sending an email to your registered address. Continued use after changes constitutes acceptance of the updated Terms.</p>
      </Section>

      <Section title="13. Governing Law">
        <p>These Terms are governed by the laws of <strong>New South Wales, Australia</strong>. Any disputes will be subject to the exclusive jurisdiction of the courts of New South Wales.</p>
      </Section>

      <Section title="14. Contact Us">
        <p>Questions about these Terms? Reach us at <strong>support@quizworld.xyz</strong></p>
      </Section>

      <div style={{ marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--line)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link href="/privacy" className="btn btn-secondary btn-compact">Privacy Policy →</Link>
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

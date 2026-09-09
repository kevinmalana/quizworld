export function AccountDeletionRequest({ email }: { email?: string }) {
  const body = `Hello QuizWorld support,\n\nI request deletion of my QuizWorld account and associated personal data.\nAccount email: ${email ?? "[your account email]"}\n\nPlease verify my ownership and explain any data that must be retained before completing the request.\nPlease confirm receipt and completion.\n`;
  const href = `mailto:support@quizworld.xyz?subject=${encodeURIComponent("QuizWorld account deletion request")}&body=${encodeURIComponent(body)}`;
  return (
    <details>
      <summary className="btn btn-secondary">Request account deletion</summary>
      <p>This does not delete your account automatically. Your request is not sent until you send the email.</p>
      <p>Send from your account email address. Support must verify account ownership before deletion; never send a password or sign-in code. Review or export any content you want to keep first.</p>
      <a href={href} className="btn btn-secondary">Open deletion request in email app</a>
      <p>No email app? Copy the message below into an email to <strong>support@quizworld.xyz</strong>, with subject “QuizWorld account deletion request”.</p>
      <label htmlFor="deletion-request-message">Request message</label>
      <textarea id="deletion-request-message" className="profile-field-input" readOnly rows={9} value={body} />
      <p>Your account stays active while the request is reviewed. See the <a href="/privacy">Privacy Policy</a> for processing and retention details.</p>
    </details>
  );
}

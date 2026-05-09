export function PublishLoginPrompt({ onSignIn, onKeepEditing }: { onSignIn: () => void; onKeepEditing: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="card builder-login-prompt">
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔐</div>
        <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.75rem" }}>
          Sign in to publish
        </h2>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
          Your quiz is saved and will be waiting for you after sign in.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button onClick={onSignIn} className="btn btn-primary">
            Sign In / Sign Up
          </button>
          <button onClick={onKeepEditing} className="btn btn-secondary">
            Keep Editing
          </button>
        </div>
      </div>
    </div>
  );
}

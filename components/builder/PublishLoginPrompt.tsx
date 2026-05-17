export function PublishLoginPrompt({ onSignIn, onKeepEditing }: { onSignIn: () => void; onKeepEditing: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center builder-login-overlay">
      <div className="card builder-login-prompt">
        <div className="builder-login-prompt__icon">🔐</div>
        <h2 className="font-display builder-login-prompt__title">
          Sign in to publish
        </h2>
        <p className="builder-login-prompt__text">
          Your quiz is saved and will be waiting for you after sign in.
        </p>
        <div className="builder-login-prompt__actions">
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

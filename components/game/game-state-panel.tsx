import Link from "next/link";

type GameStatePanelProps = {
  icon: string;
  title: string;
  message: string;
  maxWidth?: number;
  actions?: React.ReactNode;
};

export function GameStatePanel({ icon, title, message, maxWidth = 520, actions }: GameStatePanelProps) {
  return (
    <div className="container game-state-container" style={{ maxWidth }}>
      <div className="card game-state-card">
        <div className="game-state-icon">{icon}</div>
        <h1 className="font-display game-state-title">{title}</h1>
        <p className="game-state-message">{message}</p>
        {actions && <div className="game-state-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function GameLoadingPanel() {
  return <div className="container game-loading-panel">Loading game...</div>;
}

export function GameErrorPanel({ error, pin }: { error: string; pin: string }) {
  return (
    <GameStatePanel
      icon="😕"
      title="Game unavailable"
      message={error}
      maxWidth={480}
      actions={
        <>
          <Link href={`/join?pin=${pin}`} className="btn btn-primary">Try Another PIN</Link>
          <Link href="/" className="btn btn-secondary">Back to Home</Link>
        </>
      }
    />
  );
}

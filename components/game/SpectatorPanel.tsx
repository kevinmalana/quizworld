import Link from "next/link";

export function SpectatorPanel() {
  return (
    <div className="card game-spectator">
      <p className="game-spectator-title">Spectator view</p>
      <p className="game-spectator-desc">
        The game is already in progress.<br />Watch along or join the next session.
      </p>
      <Link href="/" className="btn btn-secondary">Back to Home</Link>
    </div>
  );
}

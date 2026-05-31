import Link from "next/link";
import { QrCode } from "@/components/shared/qr-code";
import { GameNotice } from "./GameNotice";
import type { GamePlayer } from "@/lib/game/session-normalizers";

export function WaitingLobbyPanel({
  pin,
  joinUrl,
  notice,
  players,
  readyPlayers,
  readyCount,
  isHost,
  currentPlayer,
  playerSessionReady,
  amReady,
  onReady,
  onStart,
  gameMode = "classic",
}: {
  pin: string;
  joinUrl: string;
  notice: string | null;
  players: GamePlayer[];
  readyPlayers: Set<string>;
  readyCount: number;
  isHost: boolean;
  currentPlayer: GamePlayer | null;
  playerSessionReady: boolean;
  amReady: boolean;
  onReady: () => void;
  onStart: () => void;
  gameMode?: string;
}) {
  return (
    <div className="container game-lobby">
      <GameNotice notice={notice} maxWidth={640} />
      <div className="card game-lobby-card">
        <div className="game-lobby-icon">🎮</div>
        <h1 className="font-display game-lobby-title">{isHost ? "Waiting for players…" : "Waiting for host…"}</h1>

        <div className="game-lobby-pin-area lobby-pin-qr">
          <div>
            <div className="game-lobby-pin-label">Game PIN</div>
            <div className="game-lobby-pin-value">{pin}</div>
          </div>
          <div className="game-lobby-divider" />
          <div>
            <QrCode value={joinUrl} size={120} label="Scan to join" className="qr-code qr-code-sm" />
            <div className="game-lobby-qr-label">Scan to join</div>
          </div>
        </div>

        {players.length > 0 && (
          <>
            {isHost && readyCount > 0 && (
              <p className="game-lobby-ready-count">✅ {readyCount}/{players.length} players ready</p>
            )}
            <div className="game-lobby-players">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`game-lobby-player${readyPlayers.has(player.id) ? " is-ready" : ""}`}
                >
                  <span>{player.avatar || "🎮"}</span>
                  <span className="game-lobby-player-name">{player.nickname}</span>
                  {readyPlayers.has(player.id) && (
                    <span className="game-lobby-ready-badge">✅ Ready</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {!isHost && currentPlayer && !amReady && (
          <button onClick={onReady} className="btn btn-primary" style={{ width: "100%", marginBottom: "0.75rem" }}>
            Ready ✅
          </button>
        )}
        {!isHost && currentPlayer && amReady && (
          <div className="game-lobby-you-ready">✅ You&apos;re ready!</div>
        )}
        {isHost && (
          <>
            {gameMode === "survival" && players.length < 2 && players.length > 0 && (
              <div className="game-lobby-warning">⚠️ Survival works best with 3+ players</div>
            )}
            {gameMode === "team" && players.length < 2 && players.length > 0 && (
              <div className="game-lobby-warning">⚠️ Team Battle needs at least 2 players</div>
            )}
            <button
              onClick={onStart}
              disabled={players.length === 0 || (gameMode === "team" && players.length < 2)}
              className="btn btn-primary btn-lg"
              style={{ width: "100%" }}
            >
              {players.length === 0 ? "Waiting for players..."
                : gameMode === "team" && players.length < 2 ? "Need 2+ players for Team Battle"
                : "Start Game 🚀"}
            </button>
          </>
        )}
        {!isHost && !currentPlayer && playerSessionReady && (
          <Link href={`/join?pin=${pin}`} className="btn btn-secondary">
            Join this game
          </Link>
        )}
      </div>
    </div>
  );
}

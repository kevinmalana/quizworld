import { Socket, type Channel } from "phoenix";
import type { LiveTransport } from "./live";
import { liveWebSocket } from "./live-websocket";
export const productionGameService = "https://quizworld-xs0g.onrender.com";
export function gameServiceUrl(
  value = process.env.EXPO_PUBLIC_GAME_SERVICE_URL || productionGameService,
) {
  const url = new URL(value);
  if (
    url.origin !== productionGameService &&
    !(
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(url.hostname)
    )
  )
    throw new Error("Untrusted live game service configuration.");
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid live game service URL.");
  return url.origin;
}
const messages: Record<string, string> = {
  session_not_found:
    "Game expired or player session is invalid. Ask the host for a new PIN.",
  already_answered: "Your answer is already locked in.",
  answer_window_closed: "The answer window has closed.",
  eliminated: "You are spectating after elimination.",
  invalid_state: "The game has moved on. Reconnect to check.",
  invalid_player_token: "Your player session is invalid.",
  unknown_player: "Your player session no longer exists.",
  timeout:
    "Answer outcome unconfirmed. Reconnect to check; your answer will not be sent again.",
};
function failure(body: unknown) {
  const b = body as { error?: string; message?: string; reason?: string };
  return new Error(
    b?.error ||
      b?.message ||
      messages[b?.reason ?? ""] ||
      "Game request failed. Reconnect to check.",
  );
}
export function createLiveTransport(
  base = gameServiceUrl(),
  webSocket = liveWebSocket,
): LiveTransport {
  base = gameServiceUrl(base);
  let channel: Channel | null = null;
  let socket: Socket | null = null;
  return {
    async request(pin, action, payload) {
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 12000);
      try {
        const response = await fetch(
          `${base}/api/sessions/${encodeURIComponent(pin)}/${action}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "omit",
            signal: abort.signal,
          },
        );
        const body = await response.json();
        if (!response.ok) throw failure(body);
        return body;
      } catch (error) {
        if (abort.signal.aborted)
          throw new Error(
            "Connection timed out. The request outcome is not confirmed. No automatic retry was sent.",
          );
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
    connect(player, update, connection) {
      const connectionSocket = new Socket(
        `${base.replace(/^http/, "ws")}/socket`,
        {
          transport: webSocket,
          heartbeatIntervalMs: 15000,
          reconnectAfterMs: (tries) =>
            Math.min(1000 * 2 ** Math.min(tries, 5), 30000),
        },
      );
      const joined = connectionSocket.channel(`game:${player.pin}`, {
        player_id: player.player_id,
        player_token: player.player_token,
      });
      channel = joined;
      socket = connectionSocket;
      let closed = false;
      connectionSocket.onClose(() => {
        if (!closed)
          connection(
            false,
            "Connection lost. Reconnecting with your player identity…",
          );
      });
      connectionSocket.onError(() => {
        if (!closed)
          connection(false, "Cannot reach the game. Check your connection.");
      });
      joined.on("session:update", (data) => {
        if (!closed) update(data);
      });
      joined.onError(() => {
        if (!closed)
          connection(false, "Game connection interrupted. Reconnecting…");
      });
      joined.onClose(() => {
        if (!closed)
          connection(false, "Game channel closed. Reconnect to check.");
      });
      connectionSocket.connect();
      joined
        .join(10000)
        .receive("ok", (data) => {
          if (!closed) {
            connection(true);
            update(data);
          }
        })
        .receive("error", (body) => {
          if (!closed) connection(false, failure(body).message);
        })
        .receive("timeout", () => {
          if (!closed)
            connection(
              false,
              "Game connection timed out. Retrying connection, not answers.",
            );
        });
      return () => {
        closed = true;
        if (channel === joined) {
          channel = null;
          socket = null;
        }
        connectionSocket.disconnect();
      };
    },
    command(event, payload) {
      // Never let Phoenix queue a mutation until after reconnect.
      if (!socket?.isConnected() || channel?.state !== "joined")
        return Promise.reject(
          new Error("Game connection is not ready. Reconnect to check."),
        );
      return new Promise((resolve, reject) => {
        channel!
          .push(event, payload, 8000)
          .receive("ok", resolve)
          .receive("error", (body) => reject(failure(body)))
          .receive("timeout", () => reject(failure({ reason: "timeout" })));
      });
    },
  };
}

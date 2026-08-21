import { getGameServiceSocketUrl } from "@/lib/game-engine/client";

type PhoenixMessage = [string | null, string | null, string, string, unknown];

type SubscribeOptions = {
  topic: string;
  joinPayload?: Record<string, unknown>;
  onJoin?: (payload: unknown) => void;
  onSessionUpdate?: (payload: unknown) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
};

const MAX_RECONNECT_ATTEMPTS = 8;
const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

export function subscribeToPhoenixTopic(options: SubscribeOptions) {
  const socketUrl = getGameServiceSocketUrl();

  if (!socketUrl) {
    throw new Error("Phoenix socket URL is not configured.");
  }

  let ref = 0;
  let heartbeat: number | null = null;
  let reconnectTimer: number | null = null;
  let reconnectAttempts = 0;
  let intentionalClose = false;
  let socket: WebSocket;

  const nextRef = () => {
    ref += 1;
    return String(ref);
  };

  const push = (topic: string, event: string, payload: unknown = {}) => {
    if (socket.readyState === WebSocket.OPEN) {
      const message: PhoenixMessage = [null, nextRef(), topic, event, payload];
      socket.send(JSON.stringify(message));
    }
  };

  const clearHeartbeat = () => {
    if (heartbeat !== null) {
      window.clearInterval(heartbeat);
      heartbeat = null;
    }
  };

  const connect = () => {
    socket = new WebSocket(socketUrl);

    socket.addEventListener("open", () => {
      reconnectAttempts = 0;
      push(options.topic, "phx_join", options.joinPayload ?? {});

      heartbeat = window.setInterval(() => {
        push("phoenix", "heartbeat", {});
      }, 30_000);
    });

    socket.addEventListener("message", (event) => {
      let parsed: PhoenixMessage;

      try {
        parsed = JSON.parse(event.data as string) as PhoenixMessage;
      } catch {
        return;
      }

      const [, , topic, messageEvent, payload] = parsed;

      if (topic !== options.topic) {
        return;
      }

      if (messageEvent === "phx_reply" && (payload as { status?: string })?.status === "ok") {
        options.onJoin?.((payload as { response?: unknown })?.response);
        return;
      }

      if (messageEvent === "session:update") {
        options.onSessionUpdate?.(payload);
        return;
      }

      if (messageEvent === "phx_error") {
        options.onError?.("Phoenix channel error.");
      }
    });

    socket.addEventListener("error", () => {
      // Close handles reconnect policy.
    });

    socket.addEventListener("close", () => {
      clearHeartbeat();

      if (intentionalClose) {
        options.onClose?.();
        return;
      }

      options.onClose?.();

      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        options.onError?.("Connection lost after several attempts. Please refresh the page.");
        return;
      }

      const delay = Math.min(
        BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts),
        MAX_RECONNECT_DELAY_MS
      );
      reconnectAttempts += 1;

      reconnectTimer = window.setTimeout(() => {
        if (!intentionalClose) {
          connect();
        }
      }, delay);
    });
  };

  connect();

  return () => {
    intentionalClose = true;
    clearHeartbeat();

    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (socket.readyState === WebSocket.OPEN) {
      try {
        push(options.topic, "phx_leave", {});
      } catch {
        // Ignore cleanup-path errors.
      }
    }

    socket.close();
  };
}

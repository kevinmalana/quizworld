import { getGameServiceSocketUrl } from "@/lib/game-engine/client";

type PhoenixMessage = [string | null, string | null, string, string, unknown];

type SubscribeOptions = {
  topic: string;
  joinPayload?: Record<string, unknown>;
  onJoin?: (payload: unknown) => void;
  onSessionUpdate?: (payload: unknown) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
  commandTimeoutMs?: number;
};

export type PhoenixTopicSubscription = (() => void) & {
  push: (event: string, payload?: Record<string, unknown>) => Promise<unknown>;
};

const MAX_RECONNECT_ATTEMPTS = 8;
const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const DEFAULT_COMMAND_TIMEOUT_MS = 10_000;
const COMMAND_ERROR_MESSAGES: Record<string, string> = {
  invalid_player_token: "Player session is invalid.",
  unknown_player: "Player session was not found.",
  already_answered: "Your answer is already locked in.",
  answer_window_closed: "Answer window has closed.",
  not_host: "Only the host can perform this action.",
  invalid_state: "This action is not allowed right now.",
  bad_answer: "Answer does not belong to the current question.",
  eliminated: "You have been eliminated from this game.",
};

function commandError(response: unknown) {
  const error = response as { reason?: string; message?: string } | null;
  const message =
    error?.message ||
    (error?.reason ? COMMAND_ERROR_MESSAGES[error.reason] : undefined) ||
    "Game command failed.";
  return new Error(message);
}

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
  const pendingCommands = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
      timeout: number;
    }
  >();

  const nextRef = () => {
    ref += 1;
    return String(ref);
  };

  const push = (topic: string, event: string, payload: unknown = {}) => {
    if (socket.readyState === WebSocket.OPEN) {
      const messageRef = nextRef();
      const message: PhoenixMessage = [null, messageRef, topic, event, payload];
      socket.send(JSON.stringify(message));
      return messageRef;
    }

    return null;
  };

  const pushCommand = (event: string, payload: Record<string, unknown> = {}) =>
    new Promise<unknown>((resolve, reject) => {
      const messageRef = push(options.topic, event, payload);
      if (!messageRef) {
        reject(new Error("Game connection is not ready."));
        return;
      }

      const timeout = window.setTimeout(() => {
        if (!pendingCommands.delete(messageRef)) return;
        reject(new Error("Game command timed out. Please try again."));
      }, options.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS);

      pendingCommands.set(messageRef, { resolve, reject, timeout });
    });

  const rejectPendingCommands = (message: string) => {
    for (const { reject, timeout } of pendingCommands.values()) {
      window.clearTimeout(timeout);
      reject(new Error(message));
    }
    pendingCommands.clear();
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

      const [, messageRef, topic, messageEvent, payload] = parsed;

      if (topic !== options.topic) {
        return;
      }

      if (messageEvent === "phx_reply") {
        const reply = payload as { status?: string; response?: unknown };
        const pending = messageRef ? pendingCommands.get(messageRef) : undefined;

        if (pending && messageRef) {
          pendingCommands.delete(messageRef);
          window.clearTimeout(pending.timeout);
          if (reply.status === "ok") pending.resolve(reply.response);
          else pending.reject(commandError(reply.response));
          return;
        }

        if (reply.status === "ok") options.onJoin?.(reply.response);
        return;
      }

      if (messageEvent === "session:update") {
        options.onSessionUpdate?.(payload);
        return;
      }

      if (messageEvent === "phx_error") {
        rejectPendingCommands("Phoenix channel error.");
        options.onError?.("Phoenix channel error.");
        socket.close();
      }
    });

    socket.addEventListener("error", () => {
      // Close handles reconnect policy.
    });

    socket.addEventListener("close", () => {
      clearHeartbeat();
      rejectPendingCommands("Game connection closed before the command completed.");

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

  const unsubscribe = (() => {
    intentionalClose = true;
    clearHeartbeat();
    rejectPendingCommands("Game connection closed before the command completed.");

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
  }) as PhoenixTopicSubscription;

  unsubscribe.push = pushCommand;
  return unsubscribe;
}

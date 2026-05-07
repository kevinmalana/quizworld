import { getGameServiceSocketUrl } from "@/lib/game-engine/client";

type PresentationMessage = [string | null, string | null, string, string, unknown];

type PresentationCallbacks = {
  onPresentationUpdate?: (presentation: unknown) => void;
  onSlideChanged?: (presentation: unknown) => void;
  onResponseNew?: (data: { slide_id: string; responses: unknown[] }) => void;
  onQnaNew?: (data: { slide_id: string; questions: unknown[] }) => void;
  onQnaUpdated?: (data: { slide_id: string; questions: unknown[] }) => void;
  onPresentationEnded?: () => void;
  onError?: (message: string) => void;
  onClose?: () => void;
};

export function subscribeToPresentation(options: {
  presentationId: string;
  callbacks: PresentationCallbacks;
}) {
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

  const topic = `presentation:${options.presentationId}`;

  const nextRef = () => {
    ref += 1;
    return String(ref);
  };

  const push = (event: string, payload: unknown = {}) => {
    if (socket.readyState === WebSocket.OPEN) {
      const message: PresentationMessage = [null, nextRef(), topic, event, payload];
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
      push("phx_join", {});

      heartbeat = window.setInterval(() => {
        push("phoenix", {});
      }, 30_000);
    });

    socket.addEventListener("message", (event) => {
      let parsed: PresentationMessage;

      try {
        parsed = JSON.parse(event.data as string) as PresentationMessage;
      } catch {
        return;
      }

      const [, , msgTopic, msgEvent, payload] = parsed;

      if (msgTopic !== topic) {
        return;
      }

      const p = payload as Record<string, unknown>;

      if (msgEvent === "phx_reply" && p?.status === "ok") {
        const response = p?.response as Record<string, unknown> | undefined;
        if (response?.presentation) {
          options.callbacks.onPresentationUpdate?.(response.presentation);
        }
        return;
      }

      if (msgEvent === "slide:changed") {
        options.callbacks.onSlideChanged?.(p?.presentation);
        return;
      }

      if (msgEvent === "response:new") {
        options.callbacks.onResponseNew?.(p as { slide_id: string; responses: unknown[] });
        return;
      }

      if (msgEvent === "qna:new") {
        options.callbacks.onQnaNew?.(p as { slide_id: string; questions: unknown[] });
        return;
      }

      if (msgEvent === "qna:updated") {
        options.callbacks.onQnaUpdated?.(p as { slide_id: string; questions: unknown[] });
        return;
      }

      if (msgEvent === "presentation:ended") {
        options.callbacks.onPresentationEnded?.();
        return;
      }

      if (msgEvent === "phx_error") {
        options.callbacks.onError?.("Presentation channel error.");
      }
    });

    socket.addEventListener("error", () => {
      // Close handles reconnect policy.
    });

    socket.addEventListener("close", () => {
      clearHeartbeat();

      if (intentionalClose) {
        options.callbacks.onClose?.();
        return;
      }

      if (reconnectAttempts >= 8) {
        options.callbacks.onError?.("Connection lost. Please refresh.");
        options.callbacks.onClose?.();
        return;
      }

      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      reconnectAttempts += 1;

      reconnectTimer = window.setTimeout(() => {
        if (!intentionalClose) {
          connect();
        }
      }, delay);
    });
  };

  connect();

  return {
    nextSlide: () => push("slide:next"),
    prevSlide: () => push("slide:prev"),
    gotoSlide: (index: number) => push("slide:goto", { index }),
    submitResponse: (slideId: string, responseData: Record<string, unknown>, participantId: string, participantName: string) =>
      push("response:submit", { slide_id: slideId, response_data: responseData, participant_id: participantId, participant_name: participantName }),
    submitQna: (slideId: string, question: string, participantId: string, participantName: string) =>
      push("qna:submit", { slide_id: slideId, question, participant_id: participantId, participant_name: participantName }),
    upvoteQna: (questionId: string, slideId: string) =>
      push("qna:upvote", { question_id: questionId, slide_id: slideId }),
    endPresentation: () => push("presentation:end"),
    disconnect: () => {
      intentionalClose = true;
      clearHeartbeat();
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket.readyState === WebSocket.OPEN) {
        try {
          push("phx_leave", {});
        } catch {
          // Ignore cleanup errors
        }
      }
      socket.close();
    },
  };
}

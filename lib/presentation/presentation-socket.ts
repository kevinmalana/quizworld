import { getGameServiceSocketUrl } from "@/lib/game-engine/client";

type PresentationMessage = [string | null, string | null, string, string, unknown];

type PresentationCallbacks = {
  onJoined?: () => void;
  onPresentationUpdate?: (presentation: unknown) => void;
  onSlideChanged?: (presentation: unknown) => void;
  onResponseNew?: (data: { slide_id: string; responses: unknown[] }) => void;
  onQnaNew?: (data: { slide_id: string; questions: unknown[] }) => void;
  onQnaUpdated?: (data: { slide_id: string; questions: unknown[] }) => void;
  onQuizRevealed?: (data: { slide_id: string; correct_answers: string[] }) => void;
  onPresentationEnded?: () => void;
  onError?: (message: string) => void;
  onClose?: () => void;
};

export function subscribeToPresentation(options: {
  presentationId: string;
  presenterToken?: string | null;
  participantId?: string | null;
  participantToken?: string | null;
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
  let joinRef: string | null = null;
  let socket: WebSocket;
  const pendingReplies = new Map<string, (ok: boolean) => void>();

  const topic = `presentation:${options.presentationId}`;

  const nextRef = () => {
    ref += 1;
    return String(ref);
  };

  const sendMessage = (msgTopic: string, event: string, payload: unknown = {}, trackReply = false) => {
    if (socket.readyState !== WebSocket.OPEN) return Promise.resolve(false);

    const messageRef = nextRef();
    const message: PresentationMessage = [null, messageRef, msgTopic, event, payload];
    socket.send(JSON.stringify(message));

    if (!trackReply) return Promise.resolve(true);

    return new Promise<boolean>((resolve) => {
      pendingReplies.set(messageRef, resolve);
      window.setTimeout(() => {
        if (pendingReplies.delete(messageRef)) resolve(false);
      }, 8_000);
    });
  };

  const push = (event: string, payload: unknown = {}, trackReply = false) => {
    return sendMessage(topic, event, payload, trackReply);
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
      joinRef = String(ref + 1);
      void push("phx_join", {
        presenter_token: options.presenterToken || undefined,
        participant_id: options.participantId || undefined,
        participant_token: options.participantToken || undefined,
      });

      heartbeat = window.setInterval(() => {
        void sendMessage("phoenix", "heartbeat", {});
      }, 30_000);
    });

    socket.addEventListener("message", (event) => {
      let parsed: PresentationMessage;

      try {
        parsed = JSON.parse(event.data as string) as PresentationMessage;
      } catch {
        return;
      }

      const [, messageRef, msgTopic, msgEvent, payload] = parsed;

      if (msgTopic !== topic) {
        return;
      }

      const p = payload as Record<string, unknown>;

      if (msgEvent === "phx_reply") {
        const ok = p?.status === "ok";
        if (messageRef && pendingReplies.has(messageRef)) {
          pendingReplies.get(messageRef)?.(ok);
          pendingReplies.delete(messageRef);
        }

        if (ok) {
          if (messageRef === joinRef) options.callbacks.onJoined?.();
          const response = p?.response as Record<string, unknown> | undefined;
          if (response?.presentation) {
            options.callbacks.onPresentationUpdate?.(response.presentation);
          }
        } else {
          const response = p?.response as { reason?: string } | undefined;
          options.callbacks.onError?.(response?.reason || "Presentation action failed.");
        }
        return;
      }

      if (msgEvent === "presentation:update") {
        options.callbacks.onPresentationUpdate?.(p?.presentation);
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

      if (msgEvent === "quiz:revealed") {
        options.callbacks.onQuizRevealed?.(p as { slide_id: string; correct_answers: string[] });
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
    nextSlide: () => push("slide:next", { presenter_token: options.presenterToken || undefined }, true),
    prevSlide: () => push("slide:prev", { presenter_token: options.presenterToken || undefined }, true),
    gotoSlide: (index: number) => push("slide:goto", { index, presenter_token: options.presenterToken || undefined }, true),
    submitResponse: (slideId: string, responseData: Record<string, unknown>, participantName: string) =>
      push("response:submit", {
        slide_id: slideId,
        response_data: responseData,
        participant_id: options.participantId || undefined,
        participant_token: options.participantToken || undefined,
        participant_name: participantName,
      }, true),
    submitQna: (slideId: string, question: string, participantName: string) =>
      push("qna:submit", {
        slide_id: slideId,
        question,
        participant_id: options.participantId || undefined,
        participant_token: options.participantToken || undefined,
        participant_name: participantName,
      }, true),
    upvoteQna: (questionId: string, slideId: string) =>
      push("qna:upvote", {
        question_id: questionId,
        slide_id: slideId,
        participant_id: options.participantId || undefined,
        participant_token: options.participantToken || undefined,
      }, true),
    endPresentation: () => push("presentation:end", { presenter_token: options.presenterToken || undefined }, true),
    revealQuizAnswers: (slideId: string, correctAnswers: string[]) =>
      push("quiz:reveal", {
        slide_id: slideId,
        correct_answers: correctAnswers,
        presenter_token: options.presenterToken || undefined,
      }, true),
    disconnect: () => {
      intentionalClose = true;
      clearHeartbeat();
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket.readyState === WebSocket.OPEN) {
        try {
          void push("phx_leave", {});
        } catch {
          // Ignore cleanup errors
        }
      }
      socket.close();
    },
  };
}

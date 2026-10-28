import { getGameServiceSocketUrl } from "@/lib/game-engine/client";
import type { PresentationCommandOutcome } from "./command-outcome";

type PresentationMessage = [string | null, string | null, string, string, unknown];

type PresentationCallbacks = {
  onJoined?: () => void;
  /** Fired immediately on any unintentional close so consumers can fall back at once. */
  onDisconnected?: (message: string) => void;
  onPresentationUpdate?: (presentation: unknown) => void;
  onSlideChanged?: (presentation: unknown) => void;
  onResponseNew?: (data: { slide_id: string; responses: unknown[] }) => void;
  onQnaNew?: (data: { slide_id: string; questions: unknown[] }) => void;
  onQnaUpdated?: (data: { slide_id: string; questions: unknown[] }) => void;
  onQuizRevealed?: (data: { slide_id: string; correct_answers: string[] }) => void;
  onPresentationEnded?: () => void;
  onPresenterDisconnected?: (message: string) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
};

type PendingReply = {
  generation: number;
  stateRevision: number;
  topic: string;
  resolve: (outcome: PresentationCommandOutcome) => void;
  timer: number;
};

const REPLY_TIMEOUT_MS = 8_000;
const MAX_RECONNECT_ATTEMPTS = 8;

export type PresentationChannel = {
  nextSlide: () => Promise<PresentationCommandOutcome>;
  prevSlide: () => Promise<PresentationCommandOutcome>;
  gotoSlide: (index: number) => Promise<PresentationCommandOutcome>;
  submitResponse: (slideId: string, responseData: Record<string, unknown>, participantName: string) => Promise<PresentationCommandOutcome>;
  submitQna: (slideId: string, question: string, participantName: string) => Promise<PresentationCommandOutcome>;
  upvoteQna: (questionId: string, slideId: string) => Promise<PresentationCommandOutcome>;
  setResultsHidden: (hidden: boolean) => Promise<PresentationCommandOutcome>;
  endPresentation: () => Promise<PresentationCommandOutcome>;
  revealQuizAnswers: (slideId: string, correctAnswers: string[]) => Promise<PresentationCommandOutcome>;
  disconnect: () => void;
};

export function subscribeToPresentation(options: {
  presentationId: string;
  presenterToken?: string | null;
  participantId?: string | null;
  participantToken?: string | null;
  callbacks: PresentationCallbacks;
}): PresentationChannel {
  const socketUrl = getGameServiceSocketUrl();

  if (!socketUrl) {
    throw new Error("Phoenix socket URL is not configured.");
  }

  let ref = 0;
  // Generation fencing: every connect() supersedes all older sockets, so a
  // superseded generation can neither publish events nor alter (reconnect
  // scheduling, heartbeat, pending replies) the live connection.
  let generation = 0;
  let heartbeat: number | null = null;
  let reconnectTimer: number | null = null;
  let reconnectAttempts = 0;
  let intentionalClose = false;
  let joined = false;
  let stateRevision = 0;
  let lastStateReplyRef = 0;
  let socket: WebSocket;
  // The actual ref of THIS generation's phx_join — join replies are
  // correlated to what was really sent, not to a predicted value.
  let joinRef: string | null = null;

  const pendingReplies = new Map<string, PendingReply>();

  const topic = `presentation:${options.presentationId}`;

  const nextRef = () => {
    ref += 1;
    return String(ref);
  };

  const settlePending = (targetGeneration: number, outcome: PresentationCommandOutcome) => {
    for (const [messageRef, pending] of [...pendingReplies.entries()]) {
      if (pending.generation !== targetGeneration) continue;
      window.clearTimeout(pending.timer);
      pendingReplies.delete(messageRef);
      pending.resolve(outcome);
    }
  };

  const settleAllPending = (outcome: PresentationCommandOutcome) => {
    for (const targetGeneration of new Set([...pendingReplies.values()].map((p) => p.generation))) {
      settlePending(targetGeneration, outcome);
    }
  };

  const sendMessage = (
    msgTopic: string,
    event: string,
    payload: unknown = {},
    trackReply = false,
  ): { ref: string | null; settled: Promise<PresentationCommandOutcome> } => {
    if (intentionalClose || socket.readyState !== WebSocket.OPEN || (trackReply && event !== "phx_join" && !joined)) {
      // Definitely not sent — an explicit rejection, never a silent drop.
      return {
        ref: null,
        settled: Promise.resolve({ status: "rejected", reason: "Presentation socket is not connected." }),
      };
    }

    const messageRef = nextRef();
    const message: PresentationMessage = [null, messageRef, msgTopic, event, payload];
    try {
      socket.send(JSON.stringify(message));
    } catch {
      return { ref: null, settled: Promise.resolve({ status: "uncertain", reason: "Connection failed while sending the presentation action." }) };
    }

    if (!trackReply) {
      return { ref: messageRef, settled: Promise.resolve({ status: "confirmed" }) };
    }

    const replyGeneration = generation;
    return {
      ref: messageRef,
      settled: new Promise<PresentationCommandOutcome>((resolve) => {
        const timer = window.setTimeout(() => {
          if (pendingReplies.delete(messageRef)) {
            resolve({ status: "uncertain", reason: "No reply from the presentation service." });
          }
        }, REPLY_TIMEOUT_MS);
        pendingReplies.set(messageRef, { generation: replyGeneration, stateRevision, topic: msgTopic, resolve, timer });
      }),
    };
  };

  const push = (event: string, payload: unknown = {}, trackReply = false) =>
    sendMessage(topic, event, payload, trackReply).settled;

  const clearHeartbeat = () => {
    if (heartbeat !== null) {
      window.clearInterval(heartbeat);
      heartbeat = null;
    }
  };

  const connect = () => {
    generation += 1;
    joined = false;
    joinRef = null;
    const socketGeneration = generation;
    let socketClosed = false;

    socket = new WebSocket(socketUrl);

    socket.addEventListener("open", () => {
      if (socketGeneration !== generation || socketClosed) return;
      const join = sendMessage(
        topic,
        "phx_join",
        {
          presenter_token: options.presenterToken || undefined,
          participant_id: options.participantId || undefined,
          participant_token: options.participantToken || undefined,
        },
        true,
      );
      joinRef = join.ref;
      void join.settled.then((outcome) => {
        if (socketGeneration !== generation || socketClosed || intentionalClose) return;
        if (outcome.status !== "confirmed") {
          options.callbacks.onError?.(`Could not join the presentation channel. ${"reason" in outcome ? outcome.reason : ""}`);
          socket.close();
        }
      });

      heartbeat = window.setInterval(() => {
        if (socketGeneration !== generation || socketClosed || intentionalClose) return;
        void sendMessage("phoenix", "heartbeat", {}, true).settled.then((outcome) => {
          if (socketGeneration !== generation || socketClosed || intentionalClose) return;
          if (outcome.status !== "confirmed") socket.close();
        });
      }, 30_000);
    });

    socket.addEventListener("message", (event) => {
      if (socketGeneration !== generation || socketClosed) return;

      let parsed: PresentationMessage;

      try {
        parsed = JSON.parse(event.data as string) as PresentationMessage;
      } catch {
        return;
      }

      if (!Array.isArray(parsed) || parsed.length !== 5) return;
      const [, messageRef, msgTopic, msgEvent, payload] = parsed;

      if (msgTopic !== topic && msgTopic !== "phoenix") {
        return;
      }

      const p = payload as Record<string, unknown>;

      if (msgEvent === "phx_reply") {
        if (messageRef === null) return;
        const pending = pendingReplies.get(messageRef);
        if (!pending || pending.topic !== msgTopic) return;

        const ok = p?.status === "ok";
        const replyStateRevision = pending.stateRevision;
        window.clearTimeout(pending.timer);
        pendingReplies.delete(messageRef);
        pending.resolve(ok ? { status: "confirmed" } : { status: "rejected", reason: replyReason(p) });
        if (msgTopic !== topic) return;

        if (ok) {
          if (messageRef === joinRef) {
            joinRef = null;
            joined = true;
            reconnectAttempts = 0;
            options.callbacks.onJoined?.();
          }
          const response = p?.response as Record<string, unknown> | undefined;
          if (response?.presentation && replyStateRevision === stateRevision && Number(messageRef) > lastStateReplyRef) {
            lastStateReplyRef = Number(messageRef);
            options.callbacks.onPresentationUpdate?.(response.presentation);
          }
        } else if (messageRef === joinRef) {
          joinRef = null; // join.settled reports the error and reconnects.
        }
        return;
      }

      if (!joined || msgTopic !== topic) return;

      if (msgEvent === "presentation:update") {
        stateRevision += 1;
        options.callbacks.onPresentationUpdate?.(p?.presentation);
        return;
      }

      if (msgEvent === "slide:changed") {
        stateRevision += 1;
        options.callbacks.onSlideChanged?.(p?.presentation);
        return;
      }

      if (msgEvent === "activity:update") {
        const activity = p as { slide_id: string; responses: unknown[]; questions: unknown[] };
        options.callbacks.onResponseNew?.(activity);
        options.callbacks.onQnaNew?.(activity);
        options.callbacks.onQnaUpdated?.(activity);
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

      if (msgEvent === "presenter:disconnected") {
        const p = payload as { message?: string };
        options.callbacks.onPresenterDisconnected?.(p.message || "The presenter has disconnected.");
        return;
      }

      if (msgEvent === "phx_error" || msgEvent === "phx_close") {
        options.callbacks.onError?.("Presentation channel error.");
        socket.close();
      }
    });

    socket.addEventListener("error", () => {
      // Close handles reconnect policy.
    });

    socket.addEventListener("close", () => {
      if (socketGeneration !== generation || socketClosed) return; // a stale close must not touch the live connection
      socketClosed = true;
      joined = false;

      clearHeartbeat();
      settlePending(socketGeneration, {
        status: "uncertain",
        reason: "Connection lost before the presentation service replied.",
      });

      if (intentionalClose) {
        options.callbacks.onClose?.();
        return;
      }

      // Immediate, observable disconnect signal: consumers can enter their
      // read-only fallback right now instead of silently dropping commands.
      options.callbacks.onDisconnected?.("Realtime connection lost — reconnecting.");

      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        options.callbacks.onError?.("Connection lost. Please refresh.");
        options.callbacks.onClose?.();
        return;
      }

      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      reconnectAttempts += 1;

      reconnectTimer = window.setTimeout(() => {
        if (!intentionalClose && socketGeneration === generation) {
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
    setResultsHidden: (hidden: boolean) =>
      push("results:visibility", {
        hidden,
        presenter_token: options.presenterToken || undefined,
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
      generation += 1; // fence every listener and timer of this connection
      joined = false;
      settleAllPending({ status: "uncertain", reason: "Presentation socket closed before reply." });
      clearHeartbeat();
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      socket.close();
    },
  };
}

function replyReason(payload: Record<string, unknown> | undefined): string {
  const response = payload?.response as { reason?: string } | undefined;
  return typeof response?.reason === "string" && response.reason ? response.reason : "Presentation action failed.";
}

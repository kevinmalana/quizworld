"use client";

import { useEffect, useState } from "react";
import { subscribeToPhoenixTopic } from "@/lib/game-engine/phoenix-socket";

type PhoenixGameChannelOptions = {
  pin: string;
  joinPayload?: Record<string, unknown>;
  onSnapshot: (session: Record<string, unknown>) => void;
  loadSnapshot: () => Promise<void> | void;
};

const FALLBACK_INTERVAL_MS = 5_000;

function sessionFromPayload(payload: unknown) {
  return (payload as { session?: Record<string, unknown> } | null)?.session;
}

export function usePhoenixGameChannel({ pin, joinPayload, onSnapshot, loadSnapshot }: PhoenixGameChannelOptions) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let stopped = false;

    const handleSnapshot = (payload: unknown) => {
      if (stopped) return;
      setConnected(true);
      const session = sessionFromPayload(payload);
      if (session) onSnapshot(session);
    };

    const unsubscribe = subscribeToPhoenixTopic({
      topic: `game:${pin}`,
      joinPayload,
      onJoin: handleSnapshot,
      onSessionUpdate: handleSnapshot,
      onError: () => {
        if (!stopped) setConnected(false);
      },
      onClose: () => {
        if (!stopped) setConnected(false);
      },
    });

    return () => {
      stopped = true;
      unsubscribe();
    };
  }, [joinPayload, onSnapshot, pin]);

  useEffect(() => {
    const fallbackInterval = window.setInterval(() => {
      if (!connected) void loadSnapshot();
    }, FALLBACK_INTERVAL_MS);

    return () => window.clearInterval(fallbackInterval);
  }, [connected, loadSnapshot]);

  return connected;
}

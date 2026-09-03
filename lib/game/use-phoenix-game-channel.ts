"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  subscribeToPhoenixTopic,
  type PhoenixTopicSubscription,
} from "@/lib/game-engine/phoenix-socket";

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
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false);
  const subscriptionRef = useRef<{
    key: string;
    subscription: PhoenixTopicSubscription;
  } | null>(null);
  const connectionKey = `${pin}:${JSON.stringify(joinPayload ?? {})}`;

  useEffect(() => {
    let stopped = false;
    setConnected(false);
    subscriptionRef.current = null;
    const effectConnectionKey = connectionKey;

    const handleSnapshot = (payload: unknown) => {
      if (stopped) return;
      setConnected(true);
      setHasConnectedOnce(true);
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
    subscriptionRef.current = { key: effectConnectionKey, subscription: unsubscribe };

    return () => {
      stopped = true;
      if (subscriptionRef.current?.subscription === unsubscribe) subscriptionRef.current = null;
      unsubscribe();
    };
  }, [connectionKey, joinPayload, onSnapshot, pin]);

  const activeConnection = connected && subscriptionRef.current?.key === connectionKey;

  useEffect(() => {
    const fallbackInterval = window.setInterval(() => {
      if (!activeConnection) void loadSnapshot();
    }, FALLBACK_INTERVAL_MS);

    return () => window.clearInterval(fallbackInterval);
  }, [activeConnection, loadSnapshot]);

  const sendCommand = useCallback((event: string, payload: Record<string, unknown>) => {
    const current = subscriptionRef.current;
    if (!current || current.key !== connectionKey) {
      return Promise.reject(new Error("Game connection is not ready."));
    }
    return current.subscription.push(event, payload);
  }, [connectionKey]);

  return { connected: activeConnection, hasConnectedOnce, sendCommand };
}

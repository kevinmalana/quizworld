"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SerializedLatestSaveQueue, type AutosaveSnapshot } from "./serialized-latest-save";

export function useSerializedAutosave<T>(options: {
  value: T;
  revisionKey: string;
  enabled: boolean;
  debounceMs: number;
  save(value: T): Promise<unknown>;
}) {
  const saveRef = useRef(options.save);
  saveRef.current = options.save;
  const queueRef = useRef<SerializedLatestSaveQueue<T> | null>(null);
  if (!queueRef.current) queueRef.current = new SerializedLatestSaveQueue((value) => saveRef.current(value));
  const queue = queueRef.current;
  const latestValue = useRef(options.value);
  latestValue.current = options.value;
  const [snapshot, setSnapshot] = useState<AutosaveSnapshot>(queue.getSnapshot());

  useEffect(() => queue.subscribe(setSnapshot), [queue]);
  useEffect(() => {
    if (!options.enabled) return;
    queue.enqueue(latestValue.current);
    const timer = window.setTimeout(() => void queue.start(), options.debounceMs);
    return () => window.clearTimeout(timer);
  }, [options.enabled, options.revisionKey, options.debounceMs, queue]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (queue.getSnapshot().status === "saved") return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [queue]);

  const flush = useCallback(async () => {
    queue.enqueue(latestValue.current);
    await queue.flush();
    return queue.getSnapshot();
  }, [queue]);

  return { ...snapshot, flush };
}

import { useCallback, useEffect, useRef } from "react";

/** Fence a keyed component's async work; optionally supersede older reads. */
export function useAsyncScope() {
  const scope = useRef({ mounted: true, lifetime: 0, read: 0 });
  useEffect(() => {
    scope.current.mounted = true;
    return () => { scope.current.mounted = false; scope.current.lifetime++; scope.current.read++; };
  }, []);
  const capture = useCallback(() => {
    const lifetime = scope.current.lifetime;
    return () => scope.current.mounted && scope.current.lifetime === lifetime;
  }, []);
  const beginRead = useCallback(() => {
    const current = capture();
    const read = ++scope.current.read;
    return () => current() && scope.current.read === read;
  }, [capture]);
  return { capture, beginRead };
}

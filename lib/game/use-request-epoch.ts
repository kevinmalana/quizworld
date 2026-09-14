import {useCallback, useEffect, useRef} from 'react';

/** Fence async completions by composed identity and command/phase causality. */
export function useRequestEpoch(identity: string) {
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const epochRef = useRef(0);
  const invalidateRequests = useCallback(() => { epochRef.current++; }, []);
  const captureRequestGuard = useCallback(() => {
    const epoch = epochRef.current;
    return () => identityRef.current === identity && epochRef.current === epoch;
  }, [identity]);
  const beginCommand = useCallback(() => {
    invalidateRequests();
    return captureRequestGuard();
  }, [captureRequestGuard, invalidateRequests]);
  // Also invalidate on identity replacement or unmount, including A -> B -> A.
  useEffect(() => invalidateRequests, [identity, invalidateRequests]);
  return {captureRequestGuard, beginCommand, invalidateRequests};
}

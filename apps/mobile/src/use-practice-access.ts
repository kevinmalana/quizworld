import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { createPracticeAccess } from './practice-access';
import { checkPublicAccess } from './public-access';
import type { Pack } from './study/types';

export function usePracticeAccess(pack: Pack | undefined) {
  const focused = useIsFocused();
  const gate = useMemo(() => createPracticeAccess(checkPublicAccess), [pack]);
  const snapshot = useSyncExternalStore(gate.subscribe, gate.getSnapshot, gate.getSnapshot);
  useEffect(() => {
    gate.activate();
    if (!pack || !focused) { gate.suspend(); return; }
    // Both navigation focus and native foreground invalidate the previous check.
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') void gate.check(pack);
    const subscription = AppState.addEventListener('change', phase => {
      if (phase === 'active') void gate.check(pack);
      else gate.suspend();
    });
    return () => { subscription.remove(); gate.suspend(); };
  }, [gate, pack, focused]);
  // AccountBoundary unmounts the whole subtree synchronously on logout/switch.
  useEffect(() => () => gate.dispose(), [gate]);
  const phase = !focused || snapshot.pack !== pack ? 'pending' : snapshot.phase;
  return {
    phase,
    allowed: phase === 'current' || phase === 'bundled',
    retry: () => { if (pack && focused) void gate.check(pack); },
    run: (action: () => Promise<unknown>) => pack && focused ? gate.run(pack, action) : Promise.resolve(false),
  };
}

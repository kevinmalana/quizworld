import type { createAuthController } from './auth';
type Lifecycle = {
  currentState: string | null;
  addEventListener(event: 'change', listener: (state: string) => void): { remove(): void };
};
type Clock = { now(): number; set(fn: () => void, ms: number): unknown; clear(id: unknown): void };
const realClock: Clock = { now: Date.now, set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id as ReturnType<typeof setTimeout>) };

export function bindAuthLifecycle(auth: ReturnType<typeof createAuthController>, lifecycle: Lifecycle, clock: Clock = realClock) {
  let active = lifecycle.currentState === 'active';
  let timer: unknown;
  const clear = () => { if (timer !== undefined) clock.clear(timer); timer = undefined; };
  const schedule = () => {
    clear();
    const state = auth.getSnapshot();
    if (active && state.phase === 'ready' && state.user && state.expiresAt) {
      timer = clock.set(() => { void auth.restore(); }, Math.max(1000, Math.min(2147483647, state.expiresAt - clock.now() - 30000)));
    }
  };
  const unsubscribe = auth.subscribe(schedule);
  const subscription = lifecycle.addEventListener('change', next => {
    const resumed = !active && next === 'active';
    active = next === 'active';
    if (resumed && auth.getSnapshot().user) void auth.restore();
    schedule();
  });
  schedule();
  return () => { clear(); unsubscribe(); subscription.remove(); };
}

/**
 * One browser-storage seam for host and player credentials. TTL/identity policy
 * stays in the role-specific modules. A denied getter or one failed store must
 * not defeat the other usable store or throw out of a React loading effect.
 */
const stores = () => typeof window === 'undefined' ? [] : [() => sessionStorage, () => localStorage];

export function readGameSessionValue(key: string): string | null {
  for (const getStore of stores()) {
    try {
      const value = getStore().getItem(key);
      if (value !== null) return value;
    } catch { /* Try the other browser store. */ }
  }
  return null;
}

export function writeGameSessionValue(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  let saved = false;
  for (const getStore of stores()) {
    try { getStore().setItem(key, value); saved = true; }
    catch {
      // A stale preferred-store value must not shadow a new value saved in
      // the other store. Remove it when possible, then verify the read path.
      try { getStore().removeItem(key); } catch { /* Verified below. */ }
    }
  }
  if (!saved || readGameSessionValue(key) !== value) throw new Error('This browser cannot save game access. Enable browser storage before joining or hosting.');
}

export function removeGameSessionValue(key: string): void {
  for (const getStore of stores()) {
    try { getStore().removeItem(key); }
    catch { /* Best effort only; this does not revoke the server credential. */ }
  }
}

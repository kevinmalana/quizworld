// Host sessions include an expiry timestamp so stale tokens do not linger across sessions.
export type StoredHostSession = {
  hostId: string;
  hostToken: string;
};

type StoredHostSessionRaw = StoredHostSession & {
  expiresAt: number;
};

const HOST_SESSION_TTL_MS = 4 * 60 * 60 * 1000;

export function getHostSessionStorageKey(pin: string) {
  return `qw_host_session_${pin.toUpperCase()}`;
}

export function readHostSession(pin: string): StoredHostSession | null {
  if (typeof window === "undefined") return null;

  const storageKey = getHostSessionStorageKey(pin);
  const raw = sessionStorage.getItem(storageKey) ?? localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredHostSessionRaw>;
    if (!parsed.hostId || !parsed.hostToken) return null;

    if (parsed.expiresAt !== undefined && parsed.expiresAt <= Date.now()) {
      clearHostSession(pin);
      return null;
    }

    return {
      hostId: parsed.hostId,
      hostToken: parsed.hostToken,
    };
  } catch {
    return null;
  }
}

export function writeHostSession(pin: string, session: StoredHostSession) {
  if (typeof window === "undefined") return;

  const storageKey = getHostSessionStorageKey(pin);
  const value = JSON.stringify({
    ...session,
    expiresAt: Date.now() + HOST_SESSION_TTL_MS,
  } satisfies StoredHostSessionRaw);
  sessionStorage.setItem(storageKey, value);
  localStorage.setItem(storageKey, value);
}

export function clearHostSession(pin: string) {
  if (typeof window === "undefined") return;

  const storageKey = getHostSessionStorageKey(pin);
  sessionStorage.removeItem(storageKey);
  localStorage.removeItem(storageKey);
}

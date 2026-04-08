// Player sessions include an expiry timestamp so reconnect tokens do not persist indefinitely.
export type StoredPlayerSession = {
  playerId: string;
  playerToken: string;
};

type StoredPlayerSessionRaw = StoredPlayerSession & {
  expiresAt: number;
};

const PLAYER_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function getPlayerSessionStorageKey(pin: string) {
  return `qw_player_session_${pin.toUpperCase()}`;
}

export function readPlayerSession(pin: string): StoredPlayerSession | null {
  if (typeof window === "undefined") return null;

  const storageKey = getPlayerSessionStorageKey(pin);
  const raw = sessionStorage.getItem(storageKey) ?? localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredPlayerSessionRaw>;
    if (!parsed.playerId || !parsed.playerToken) return null;

    if (parsed.expiresAt !== undefined && parsed.expiresAt <= Date.now()) {
      clearPlayerSession(pin);
      return null;
    }

    return {
      playerId: parsed.playerId,
      playerToken: parsed.playerToken,
    };
  } catch {
    return null;
  }
}

export function writePlayerSession(pin: string, session: StoredPlayerSession) {
  if (typeof window === "undefined") return;

  const storageKey = getPlayerSessionStorageKey(pin);
  const value = JSON.stringify({
    ...session,
    expiresAt: Date.now() + PLAYER_SESSION_TTL_MS,
  } satisfies StoredPlayerSessionRaw);
  sessionStorage.setItem(storageKey, value);
  localStorage.setItem(storageKey, value);
}

export function clearPlayerSession(pin: string) {
  if (typeof window === "undefined") return;

  const storageKey = getPlayerSessionStorageKey(pin);
  sessionStorage.removeItem(storageKey);
  localStorage.removeItem(storageKey);
}

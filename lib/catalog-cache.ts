export type CatalogCacheSnapshot<T> = {
  items: T[];
  savedAt: number;
  ageMs: number;
  stale: boolean;
};

type CatalogCacheEnvelope<T> = {
  savedAt: number;
  items: T[];
};

export function serializeCatalogCache<T>(items: T[], savedAt = Date.now()) {
  return JSON.stringify({ savedAt, items } satisfies CatalogCacheEnvelope<T>);
}

export function parseCatalogCache<T>(
  raw: string | null | undefined,
  maxAgeMs: number,
  now = Date.now()
): CatalogCacheSnapshot<T> | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<CatalogCacheEnvelope<T>>;
    if (!Array.isArray(parsed.items) || typeof parsed.savedAt !== "number" || !Number.isFinite(parsed.savedAt)) {
      return null;
    }

    const ageMs = Math.max(0, now - parsed.savedAt);
    return {
      items: parsed.items,
      savedAt: parsed.savedAt,
      ageMs,
      stale: ageMs > maxAgeMs,
    };
  } catch {
    return null;
  }
}

export function readCatalogCache<T>(
  storageKey: string,
  maxAgeMs: number,
  now = Date.now()
): CatalogCacheSnapshot<T> | null {
  if (typeof window === "undefined") return null;

  try {
    return parseCatalogCache<T>(window.localStorage.getItem(storageKey), maxAgeMs, now);
  } catch {
    return null;
  }
}

export function writeCatalogCache<T>(storageKey: string, items: T[], savedAt = Date.now()) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey, serializeCatalogCache(items, savedAt));
  } catch {
    // Ignore storage failures (private browsing, quota, etc.) and keep the live experience working.
  }
}

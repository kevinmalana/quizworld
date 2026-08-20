const REDIRECT_KEY = "qw_post_login_redirect";
const DEFAULT_REDIRECT = "/dashboard";

export type RedirectStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function normalizePostLoginRedirect(value: string | null | undefined, fallback = DEFAULT_REDIRECT): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://quizworld.local");
    if (parsed.origin !== "https://quizworld.local" || parsed.pathname === "/login") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function rememberPostLoginRedirect(storage: RedirectStorage, next: string): string {
  const normalized = normalizePostLoginRedirect(next);
  storage.setItem(REDIRECT_KEY, normalized);
  return normalized;
}

export function consumePostLoginRedirect(storage: RedirectStorage, requested?: string | null): string {
  const stored = storage.getItem(REDIRECT_KEY);
  storage.removeItem(REDIRECT_KEY);
  return normalizePostLoginRedirect(requested || stored);
}

export function peekPostLoginRedirect(storage: Pick<RedirectStorage, "getItem">, requested?: string | null): string {
  return normalizePostLoginRedirect(requested || storage.getItem(REDIRECT_KEY));
}

export function buildLoginHref(next: string): string {
  return `/login?next=${encodeURIComponent(normalizePostLoginRedirect(next))}`;
}

export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password !== confirmation) return "Passwords do not match.";
  return null;
}

export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quizworld.xyz"
);

export const DISPLAY_SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

export function absoluteUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalizedPath}`;
}

export function gameJoinUrl(pin: string) {
  return absoluteUrl(`/join?pin=${encodeURIComponent(pin)}`);
}

export function presentationJoinUrl(joinCode: string) {
  return absoluteUrl(`/present/join?code=${encodeURIComponent(joinCode)}`);
}

function normalizeSiteUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

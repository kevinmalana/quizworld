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

export function qrCodeUrl(data: string, size = 260) {
  const boundedSize = Math.max(96, Math.min(size, 512));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${boundedSize}x${boundedSize}&data=${encodeURIComponent(data)}`;
}

function normalizeSiteUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export const GAME_PIN_LENGTH = 6;

export function sanitizeGamePinInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, GAME_PIN_LENGTH);
}

export function getGamePinDigits(value: string) {
  const sanitized = sanitizeGamePinInput(value);
  return Array.from({ length: GAME_PIN_LENGTH }, (_, index) => sanitized[index] ?? "");
}

export function isCompleteGamePin(value: string) {
  return sanitizeGamePinInput(value).length === GAME_PIN_LENGTH;
}

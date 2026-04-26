export const GAME_PIN_LENGTH = 6;

export function sanitizeGamePinInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, GAME_PIN_LENGTH);
}

export function getGamePinDigits(value: string) {
  const sanitized = sanitizeGamePinInput(value);
  return Array.from({ length: GAME_PIN_LENGTH }, (_, index) => sanitized[index] ?? "");
}

export function mergeGamePinDigits(currentDigits: string[], insertedValue: string, startIndex: number) {
  const nextDigits = Array.from({ length: GAME_PIN_LENGTH }, (_, index) => currentDigits[index] ?? "");
  const insertedDigits = sanitizeGamePinInput(insertedValue).split("");

  insertedDigits.forEach((digit, offset) => {
    const targetIndex = startIndex + offset;
    if (targetIndex < GAME_PIN_LENGTH) {
      nextDigits[targetIndex] = digit;
    }
  });

  return nextDigits;
}

export function isCompleteGamePin(value: string) {
  return sanitizeGamePinInput(value).length === GAME_PIN_LENGTH;
}

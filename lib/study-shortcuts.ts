export function getStudyAnswerShortcutIndex(key: string, answerCount: number) {
  const normalizedKey = key.trim().toLowerCase();
  const numericIndex = /^[1-9]$/.test(normalizedKey) ? Number(normalizedKey) - 1 : -1;
  const letterIndex = normalizedKey.length === 1 ? normalizedKey.charCodeAt(0) - 97 : -1;
  const index = numericIndex >= 0 ? numericIndex : letterIndex;

  return index >= 0 && index < answerCount ? index : null;
}

export function isEditableShortcutTarget(target: EventTarget | null) {
  const HTMLElementCtor = globalThis.HTMLElement;
  if (!HTMLElementCtor || !(target instanceof HTMLElementCtor)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

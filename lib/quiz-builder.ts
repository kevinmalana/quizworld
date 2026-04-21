export type MoveDirection = "up" | "down";

export function getAdjacentMoveTarget(index: number, direction: MoveDirection, total: number) {
  if (total <= 0 || index < 0 || index >= total) return index;
  if (direction === "up") return Math.max(0, index - 1);
  return Math.min(total - 1, index + 1);
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

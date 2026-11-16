/**
 * Layout and hit-testing for a vertical list whose rows are dragged to reorder. Rows can have
 * different heights (an open editor next to compact rows).
 */
export interface RowFrame {
  id: string;
  y: number;
  height: number;
}

/** Where each row sits, top to bottom, for an order and the measured heights. */
export function stackRows(
  order: readonly string[],
  heights: Readonly<Record<string, number>>,
  gap: number,
): { frames: RowFrame[]; height: number } {
  const frames: RowFrame[] = [];
  let y = 0;
  for (const id of order) {
    const height = heights[id] ?? 0;
    frames.push({ id, y, height });
    y += height + gap;
  }
  return { frames, height: Math.max(0, y - gap) };
}

/**
 * The position the dragged row belongs at: after every other row whose middle its own centre
 * has passed. Crossing a row's middle (not its edge) is what keeps two rows of different
 * heights from swapping back and forth.
 */
export function hoverIndex(frames: readonly RowFrame[], id: string, centreY: number): number {
  'worklet';
  let index = 0;
  for (const f of frames) {
    if (f.id === id) continue;
    if (f.y + f.height / 2 < centreY) index++;
  }
  return index;
}

/** `order` with `id` moved to `index` (the same array when it's already there). */
export function moveTo<T extends string>(order: readonly T[], id: T, index: number): readonly T[] {
  const from = order.indexOf(id);
  if (from < 0) return order;
  const to = Math.max(0, Math.min(order.length - 1, index));
  if (from === to) return order;
  const next = order.filter((x) => x !== id);
  next.splice(to, 0, id);
  return next;
}

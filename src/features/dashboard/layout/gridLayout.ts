/**
 * Where every home card sits, computed instead of measured. The grid used to be a flex-wrap
 * row whose cells jumped when the order changed; now each cell is placed absolutely from
 * these frames and animates between them, so cards slide aside while one is dragged and the
 * dragged card never jumps under the finger.
 *
 * Same rules as the old flex-wrap: left to right, wrap when the next card doesn't fit, a row
 * is as tall as its tallest card, GRID_GAP between cards and rows.
 */
export interface GridItem {
  id: string;
  width: number;
  height: number;
}

export interface GridFrame {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeGrid(items: readonly GridItem[], containerWidth: number, gap: number) {
  'worklet';
  const frames: GridFrame[] = [];
  let x = 0;
  let y = 0;
  let lineHeight = 0;
  for (const item of items) {
    if (x > 0 && x + item.width > containerWidth + 0.5) {
      y += lineHeight + gap;
      x = 0;
      lineHeight = 0;
    }
    frames.push({ id: item.id, x, y, width: item.width, height: item.height });
    x += item.width + gap;
    lineHeight = Math.max(lineHeight, item.height);
  }
  return { frames, height: frames.length ? y + lineHeight : 0 };
}

/**
 * The card under the dragged card's centre, if any (never the dragged card itself). Runs on
 * the UI thread while dragging.
 */
export function hoverTarget(
  frames: readonly GridFrame[],
  dragId: string,
  cx: number,
  cy: number,
): string | null {
  'worklet';
  for (const f of frames) {
    if (f.id === dragId) continue;
    if (cx >= f.x && cx <= f.x + f.width && cy >= f.y && cy <= f.y + f.height) return f.id;
  }
  return null;
}

/** `fromId` moved to `toId`'s position (the others shift by one). */
export function moveItem<T extends { id: string }>(list: readonly T[], fromId: string, toId: string): T[] {
  const from = list.findIndex((w) => w.id === fromId);
  const to = list.findIndex((w) => w.id === toId);
  if (from < 0 || to < 0 || from === to) return list as T[];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** Speed (px per frame) to scroll the page while a card is held near its top or bottom edge. */
export function autoScrollSpeed(
  fingerY: number,
  viewportTop: number,
  viewportBottom: number,
  zone = 90,
  max = 14,
) {
  'worklet';
  if (fingerY < viewportTop + zone) return -max * Math.min(1, (viewportTop + zone - fingerY) / zone);
  if (fingerY > viewportBottom - zone) return max * Math.min(1, (fingerY - (viewportBottom - zone)) / zone);
  return 0;
}

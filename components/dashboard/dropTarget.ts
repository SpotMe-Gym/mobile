import type { WidgetId } from '../../store/dashboardStore';

/** Cell rect in grid-local coordinates (scroll independent, same units as pan translation). */
export interface WidgetFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A slot must be this covered to win the drop. */
const MIN_COVERAGE = 0.5;

function overlapArea(a: WidgetFrame, b: WidgetFrame): number {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y;
}

/**
 * Commit a drop only when a slot is more than half covered by the dragged card,
 * and that slot is covered more than the card's own cell still is.
 *
 * Coverage is normalized by the smaller of the two rects. Normalizing by the
 * dragged card alone caps a full-span card at exactly 0.5 over a single-column
 * slot, so wide cards could never be moved onto narrow ones.
 */
export function findDropTarget(
  fromId: WidgetId,
  translationX: number,
  translationY: number,
  widgets: { id: WidgetId }[],
  frames: Record<string, WidgetFrame>,
): WidgetId | null {
  const source = frames[fromId];
  if (!source) return null;

  const sourceArea = source.width * source.height;
  if (sourceArea <= 0) return null;

  const dragged: WidgetFrame = {
    x: source.x + translationX,
    y: source.y + translationY,
    width: source.width,
    height: source.height,
  };

  const homeCoverage = overlapArea(dragged, source) / sourceArea;

  let best: WidgetId | null = null;
  let bestCoverage = MIN_COVERAGE;

  for (const widget of widgets) {
    if (widget.id === fromId) continue;
    const frame = frames[widget.id];
    if (!frame) continue;
    const area = frame.width * frame.height;
    if (area <= 0) continue;

    const coverage = overlapArea(dragged, frame) / Math.min(sourceArea, area);
    if (coverage > bestCoverage) {
      bestCoverage = coverage;
      best = widget.id;
    }
  }

  if (!best || homeCoverage >= bestCoverage) return null;
  return best;
}

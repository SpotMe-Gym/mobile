import type { WidgetId } from '../../store/dashboardStore';

export interface WidgetFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

function overlapArea(a: WidgetFrame, b: WidgetFrame): number {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y;
}

/**
 * Commit a drop only when more than half of the dragged card sits on another
 * slot — and more of it is on that slot than on its original cell.
 * Dragging a bit (or returning home) must not reorder.
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

  const draggedArea = source.width * source.height;
  if (draggedArea <= 0) return null;

  const dragged: WidgetFrame = {
    x: source.x + translationX,
    y: source.y + translationY,
    width: source.width,
    height: source.height,
  };

  const homeRatio = overlapArea(dragged, source) / draggedArea;
  if (homeRatio > 0.5) return null;

  let best: WidgetId | null = null;
  let bestRatio = 0.5;

  for (const widget of widgets) {
    if (widget.id === fromId) continue;
    const frame = frames[widget.id];
    if (!frame) continue;
    const ratio = overlapArea(dragged, frame) / draggedArea;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = widget.id;
    }
  }

  return best;
}

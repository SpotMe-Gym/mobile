import type { WidgetKind } from './types';

export type WidgetSize = 'full' | 'half' | 'compact';

export const GRID_GAP = 16;
/** Short bar height for quick-actions — buttons, not tiles. */
export const ACTION_HEIGHT = 56;

export const SIZE_CYCLE: WidgetSize[] = ['full', 'half', 'compact'];

export function getColumnWidth(containerWidth: number): number {
  return Math.floor((containerWidth - GRID_GAP) / 2);
}

/** Width of a full-span cell. Shared by cards and actions so neither can outgrow the other. */
export function getFullWidth(containerWidth: number): number {
  const unit = getColumnWidth(containerWidth);
  return unit * 2 + GRID_GAP;
}

export interface WidgetDimensions {
  width: number;
  height: number;
  span: 1 | 2;
}

/**
 * Unit grid. Cards: 1-col is square, full-span uses that same height.
 * Actions: same widths as cards, fixed short height.
 */
export function getWidgetDimensions(
  size: WidgetSize,
  containerWidth: number,
  kind: WidgetKind = 'card',
): WidgetDimensions {
  const unit = getColumnWidth(containerWidth);
  const fullWidth = getFullWidth(containerWidth);
  const dims: WidgetDimensions =
    size === 'full'
      ? { width: fullWidth, height: unit, span: 2 }
      : { width: unit, height: unit, span: 1 };

  if (kind === 'action') {
    return { ...dims, height: ACTION_HEIGHT };
  }
  return dims;
}

export function nextSize(current: WidgetSize, supported: WidgetSize[]): WidgetSize {
  const cycle = SIZE_CYCLE.filter(s => supported.includes(s));
  if (cycle.length === 0) return current;
  const i = cycle.indexOf(current);
  return cycle[(i + 1) % cycle.length];
}

export function snapSize(
  liveWidth: number,
  liveHeight: number,
  containerWidth: number,
  supported: WidgetSize[],
  current: WidgetSize,
  kind: WidgetKind = 'card',
): WidgetSize {
  const sizes = supported.length > 0 ? supported : SIZE_CYCLE;
  let best = current;
  let bestDist = Infinity;

  for (const size of sizes) {
    const dims = getWidgetDimensions(size, containerWidth, kind);
    const dist =
      kind === 'action'
        ? (dims.width - liveWidth) ** 2
        : (dims.width - liveWidth) ** 2 + (dims.height - liveHeight) ** 2;
    const isSquareTwin =
      kind === 'card' &&
      (size === 'half' || size === 'compact') &&
      (current === 'half' || current === 'compact') &&
      size !== current;
    const score = dist + (isSquareTwin ? 8 : 0);
    if (score < bestDist) {
      bestDist = score;
      best = size;
    }
  }

  return best;
}

export function inferWidgetSize(cardWidth: number, cardHeight: number): WidgetSize {
  if (cardWidth <= 0 || cardHeight <= 0) return 'half';
  if (cardWidth >= cardHeight * 1.4) return 'full';
  return 'half';
}

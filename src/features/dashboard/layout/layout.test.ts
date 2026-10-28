import { getWidgetDimensions, nextSize, snapSize } from '@/features/dashboard/layout/widgetSizes';

describe('widget sizes', () => {
  it('cycles through supported sizes', () => {
    expect(nextSize('full', ['full', 'half'])).toBe('half');
    expect(nextSize('half', ['full', 'half'])).toBe('full');
  });
  it('snaps a resize to the nearest size', () => {
    const full = getWidgetDimensions('full', 360);
    expect(snapSize(full.width - 10, full.height, 360, ['full', 'half', 'compact'], 'half')).toBe('full');
  });
});

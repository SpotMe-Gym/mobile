import { findDropTarget } from '@/components/dashboard/dropTarget';
import { getWidgetDimensions, nextSize, snapSize } from '@/components/dashboard/widgetSizes';

const frames = {
  a: { x: 0, y: 0, width: 100, height: 100 },
  b: { x: 116, y: 0, width: 100, height: 100 },
  c: { x: 0, y: 116, width: 216, height: 100 },
};
const widgets = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('findDropTarget', () => {
  it('ignores small nudges', () => {
    expect(findDropTarget('a', 20, 0, widgets, frames)).toBeNull();
  });
  it('drops onto a slot covered more than half', () => {
    expect(findDropTarget('a', 110, 0, widgets, frames)).toBe('b');
  });
  it('lets a wide card move onto a narrow slot', () => {
    expect(findDropTarget('c', 0, -116, widgets, frames)).toBe('a');
  });
});

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

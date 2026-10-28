import { autoScrollSpeed, computeGrid, hoverTarget, moveItem } from '@/features/dashboard/layout/gridLayout';

// 360 wide, 16 gap: a column is 172, full width 360, actions 56 tall.
const col = 172;
const items = [
  { id: 'weight', width: 360, height: col }, // full
  { id: 'plan', width: col, height: col },
  { id: 'food', width: col, height: col },
  { id: 'meal', width: col, height: 56 }, // action
  { id: 'body', width: col, height: col },
];

describe('grid layout', () => {
  it('places cards like the flex-wrap grid did', () => {
    const { frames, height } = computeGrid(items, 360, 16);
    expect(frames.map((f) => [f.id, f.x, f.y])).toEqual([
      ['weight', 0, 0],
      ['plan', 0, 188],
      ['food', 188, 188],
      ['meal', 0, 376],
      ['body', 188, 376],
    ]);
    expect(height).toBe(376 + col);
  });

  it('finds the card under the dragged card centre, never itself', () => {
    const { frames } = computeGrid(items, 360, 16);
    expect(hoverTarget(frames, 'plan', 250, 250)).toBe('food');
    expect(hoverTarget(frames, 'plan', 80, 250)).toBeNull(); // over its own slot
    expect(hoverTarget(frames, 'plan', 180, 250)).toBeNull(); // in the gap
  });

  it('moves a card to another card position', () => {
    expect(moveItem(items, 'body', 'plan').map((i) => i.id)).toEqual([
      'weight',
      'body',
      'plan',
      'food',
      'meal',
    ]);
    expect(moveItem(items, 'weight', 'meal').map((i) => i.id)).toEqual([
      'plan',
      'food',
      'meal',
      'weight',
      'body',
    ]);
    expect(moveItem(items, 'x', 'plan')).toBe(items);
  });

  it('scrolls faster the closer the finger gets to an edge', () => {
    expect(autoScrollSpeed(400, 0, 800)).toBe(0);
    expect(autoScrollSpeed(10, 0, 800)).toBeLessThan(0);
    expect(autoScrollSpeed(795, 0, 800)).toBeGreaterThan(autoScrollSpeed(740, 0, 800));
  });
});

import { hoverIndex, moveTo, stackRows } from '@/shared/lib/reorder';

describe('reorder', () => {
  const heights = { a: 60, b: 200, c: 60 };

  it('stacks rows of different heights with a gap', () => {
    const { frames, height } = stackRows(['a', 'b', 'c'], heights, 10);
    expect(frames.map((f) => f.y)).toEqual([0, 70, 280]);
    expect(height).toBe(340);
    expect(stackRows([], heights, 10).height).toBe(0);
    // A row not measured yet takes no room.
    expect(stackRows(['a', 'x', 'c'], heights, 10).frames[2]!.y).toBe(80);
  });

  it('moves a row once its centre passes the middle of the next one', () => {
    const { frames } = stackRows(['a', 'b', 'c'], heights, 10);
    expect(hoverIndex(frames, 'a', 30)).toBe(0); // where it started
    expect(hoverIndex(frames, 'a', 160)).toBe(0); // over b, not past its middle (170)
    expect(hoverIndex(frames, 'a', 175)).toBe(1);
    expect(hoverIndex(frames, 'a', 400)).toBe(2);
    expect(hoverIndex(frames, 'c', 20)).toBe(0);
  });

  it('stays put after a swap instead of flipping back', () => {
    // a dragged past b: the new layout is b, a, c. The same finger position still says index 1.
    const after = stackRows(['b', 'a', 'c'], heights, 10).frames;
    expect(hoverIndex(after, 'a', 175)).toBe(1);
  });

  it('moves an id to an index, clamped', () => {
    expect(moveTo(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a']);
    expect(moveTo(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
    expect(moveTo(['a', 'b', 'c'], 'b', 9)).toEqual(['a', 'c', 'b']);
    const same = ['a', 'b'];
    expect(moveTo(same, 'a', 0)).toBe(same);
    expect(moveTo(same, 'x', 1)).toBe(same);
  });
});

import {
  EXERCISES,
  frameUrls,
  getLibraryExercise,
  groupOf,
  searchExercises,
} from '@/features/exercises/library';

describe('exercise library', () => {
  it('ships the whole public-domain dataset with photos', () => {
    expect(EXERCISES.length).toBeGreaterThan(850);
    const squat = getLibraryExercise('Barbell_Squat');
    expect(squat?.primary).toContain('quadriceps');
    expect(frameUrls('Barbell_Squat')).toEqual([
      expect.stringMatching(
        /^https:\/\/cdn\.jsdelivr\.net\/gh\/yuhonas\/free-exercise-db@[0-9a-f]{40}\/exercises\/Barbell_Squat\/0\.jpg$/,
      ),
      expect.stringMatching(/Barbell_Squat\/1\.jpg$/),
    ]);
  });

  it('finds exercises in English, best matches first', () => {
    const names = searchExercises('bench press')
      .slice(0, 5)
      .map((e) => e.name.toLowerCase());
    expect(names.every((n) => n.includes('bench') && n.includes('press'))).toBe(true);
  });

  it('understands Italian gym words', () => {
    expect(searchExercises('panca')[0]?.name.toLowerCase()).toContain('bench');
    expect(searchExercises('stacco').some((e) => /deadlift/i.test(e.name))).toBe(true);
    expect(
      searchExercises('rematore manubri').some((e) => /dumbbell/i.test(e.name) && /row/i.test(e.name)),
    ).toBe(true);
  });

  it('filters by muscle group', () => {
    const legs = searchExercises('', { group: 'legs' }, 500);
    expect(legs.length).toBeGreaterThan(50);
    expect(legs.every((e) => e.primary.some((m) => groupOf(m) === 'legs'))).toBe(true);
  });
});

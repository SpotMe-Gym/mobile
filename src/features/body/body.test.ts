import { carryForward, cleanValues, latestBia, sanitizeBodyState } from '@/features/body/bodyStore';
import { buildSnapshots, measurementDeltas, segmentDeltas } from '@/features/body/snapshots';
import { clampOrbit, createOrbit, orbitToCamera, radiusLimits } from '@/features/body/components/orbit';
import { validateBia } from '@/features/body/bia';
import type { BiaReport, MeasurementEntry } from '@/features/body/types';

const entry = (day: string, values: MeasurementEntry['values']): MeasurementEntry => ({
  id: day,
  source: 'manual',
  day,
  createdAt: `${day}T10:00:00.000Z`,
  values,
});

describe('body store helpers', () => {
  it('cleans values', () => {
    expect(cleanValues({ waist: 80.04, chest: -1, bogus: 3 } as never)).toEqual({ waist: 80 });
  });

  it('carries the latest value per key forward', () => {
    const entries = [entry('2026-10-01', { waist: 82, chest: 100 }), entry('2026-10-08', { waist: 80 })];
    expect(carryForward(entries)).toEqual({ waist: 80, chest: 100 });
    expect(carryForward(entries, '2026-10-05')).toEqual({ waist: 82, chest: 100 });
  });

  it('sanitizes persisted state', () => {
    const s = sanitizeBodyState({ measurements: [entry('2026-10-02', { waist: 80 }), { day: 'bad' }], biaReports: 'x' });
    expect(s.measurements).toHaveLength(1);
    expect(s.biaReports).toEqual([]);
  });

  it('finds the latest BIA report', () => {
    const r = (day: string): BiaReport => ({ id: day, source: 'bia', day, createdAt: day });
    expect(latestBia([r('2026-10-01'), r('2026-10-09')], '2026-10-05')?.id).toBe('2026-10-01');
  });
});

describe('snapshots', () => {
  const src = {
    gender: 'female' as const,
    heightCm: 165,
    weights: [
      { id: 'a', day: '2026-10-01', kg: 62, createdAt: '' },
      { id: 'b', day: '2026-10-15', kg: 60, createdAt: '' },
    ],
    measurements: [
      entry('2026-10-01', { waist: 74, hips: 98 }),
      entry('2026-10-08', { waist: 73 }),
      entry('2026-10-15', { waist: 71.5, bicepsL: 28 }),
    ],
    biaReports: [],
  };

  it('compares with the previous session', () => {
    const { current, baseline } = buildSnapshots(src, 'previous');
    expect(current.weightKg).toBe(60);
    expect(baseline?.day).toBe('2026-10-08');
    expect(baseline?.weightKg).toBe(62);
    expect(measurementDeltas(current, baseline)).toEqual({ waist: -1.5, hips: 0 });
  });

  it('compares with the first session', () => {
    const { current, baseline } = buildSnapshots(src, 'first');
    expect(measurementDeltas(current, baseline)).toEqual({ waist: -2.5, hips: 0 });
  });

  it('needs two sessions for a baseline and falls back for missing profile data', () => {
    const { current, baseline } = buildSnapshots(
      { gender: null, heightCm: null, weights: [], measurements: [], biaReports: [] },
      'previous',
    );
    expect(baseline).toBeNull();
    expect(current.gender).toBe('neutral');
    expect(current.weightKg).toBeGreaterThan(50);
  });

  it('diffs BIA segments', () => {
    const bia = (id: string, lean: number): BiaReport => ({
      id,
      source: 'bia',
      day: id,
      createdAt: id,
      segmental: { armL: { leanKg: lean, fatKg: 1 } },
    });
    const current = { ...buildSnapshots(src, 'previous').current, composition: bia('b', 3.4) };
    const baseline = { ...current, composition: bia('a', 3.0) };
    expect(segmentDeltas(current, baseline).armL?.leanKg).toBeCloseTo(0.4);
  });
});

describe('orbit camera', () => {
  it('clamps zoom so the camera stays outside the body and in view', () => {
    const { min, max } = radiusLimits(1.75);
    expect(clampOrbit({ ...createOrbit(1.75), radius: 0.1 }).radius).toBe(min);
    expect(clampOrbit({ ...createOrbit(1.75), radius: 99 }).radius).toBe(max);
  });

  it('never goes under the floor', () => {
    for (const radius of [1.1, 3, 5.6]) {
      const o = clampOrbit({ ...createOrbit(1.75), radius, polar: Math.PI });
      expect(orbitToCamera(o).position[1]).toBeGreaterThanOrEqual(0.049);
    }
  });

  it('rotates freely around the body', () => {
    const o = clampOrbit({ ...createOrbit(1.75), azimuth: 10 });
    expect(o.azimuth).toBe(10);
  });
});

describe('BIA validation', () => {
  it('keeps plausible fields and segments', () => {
    const r = validateBia({
      day: '2026-10-20',
      bodyFatPct: 18.4,
      skeletalMuscleKg: 36,
      visceralFatLevel: 999,
      segmental: { armL: { leanKg: 3.4, fatKg: 0.9 }, legR: { leanKg: -1 } },
    });
    expect(r).toMatchObject({ bodyFatPct: 18.4, skeletalMuscleKg: 36, segmental: { armL: { leanKg: 3.4, fatKg: 0.9 } } });
    expect(r?.visceralFatLevel).toBeUndefined();
    expect(r?.segmental?.legR).toBeUndefined();
  });
  it('rejects empty reports and bad days', () => {
    expect(validateBia({ day: '2026-10-20' })).toBeNull();
    expect(validateBia({ day: 'yesterday', bodyFatPct: 20 })).toBeNull();
  });
});

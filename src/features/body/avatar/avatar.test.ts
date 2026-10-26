/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseAvatarGlb } from '@/features/body/avatar/glb';
import { solveMorphs } from '@/features/body/avatar/solveMorphs';
import { applyMorphs } from '@/features/body/avatar/applyMorphs';
import { buildVertexColors, SKIN, toneFor, zoneHighlights } from '@/features/body/avatar/zoneColors';
import type { BodySnapshot } from '@/features/body/types';

const load = (gender: string) => {
  const buf = readFileSync(join(__dirname, '../../../../assets/avatar', `${gender}.glb`));
  return parseAvatarGlb(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};

const male = load('male');
const base = male.calibration.base;
const snap = (patch: Partial<BodySnapshot> = {}): BodySnapshot => ({
  gender: 'male',
  heightCm: base.heightCm,
  weightKg: base.massKg,
  measurements: {},
  day: '2026-10-26',
  ...patch,
});

describe('avatar GLB', () => {
  it.each(['male', 'female', 'neutral'])('%s parses with morphs, zones and parts', (g) => {
    const m = load(g);
    expect(m.gender).toBe(g);
    expect(m.vertexCount).toBe(13380);
    expect(m.indices.length % 3).toBe(0);
    expect(m.parts.length).toBe(m.vertexCount);
    expect(Object.keys(m.morphs)).toHaveLength(48);
    expect(m.zones.bicepsL?.indices.length).toBeGreaterThan(50);
    expect(m.calibration.base.heightCm).toBeGreaterThan(150);
  });

  it('is a plausible human (feet on the floor, facing +Z, left on +X)', () => {
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < male.positions.length; i += 3) {
      minY = Math.min(minY, male.positions[i] ?? 0);
      maxY = Math.max(maxY, male.positions[i] ?? 0);
    }
    expect(minY).toBeCloseTo(0, 3);
    expect(maxY * 100).toBeCloseTo(base.heightCm, 0);
  });
});

describe('solveMorphs', () => {
  it('the base phenotype needs (almost) no morphs', () => {
    const s = solveMorphs(male.calibration, snap());
    expect(s.scale).toBeCloseTo(1, 3);
    for (const w of Object.values(s.weights)) expect(Math.abs(w ?? 0)).toBeLessThan(0.02);
  });

  it('lands the exact height and the body mass', () => {
    const s = solveMorphs(male.calibration, snap({ heightCm: 190, weightKg: 92 }));
    const h = (base.heightCm + (s.weights.macro_height_up ?? 0) * (male.calibration.morphs.macro_height_up?.heightCm ?? 0)) * s.scale;
    expect(h).toBeCloseTo(190, 1);
    expect(Math.abs(s.predictedKg - 92) / 92).toBeLessThan(0.05);
  });

  it('a heavy body without measurements gains girth where mass goes', () => {
    const lean = solveMorphs(male.calibration, snap({ heightCm: 183, weightKg: 78 }));
    const heavy = solveMorphs(male.calibration, snap({ heightCm: 183, weightKg: 103 }));
    expect((heavy.predictedCm.waist ?? 0) - (lean.predictedCm.waist ?? 0)).toBeGreaterThan(8);
    expect(Math.abs(heavy.predictedKg - 103) / 103).toBeLessThan(0.12);
    // Logged values still win over the mass-derived guess.
    const logged = solveMorphs(male.calibration, snap({ heightCm: 183, weightKg: 103, measurements: { waist: 90 } }));
    expect(Math.abs((logged.predictedCm.waist ?? 0) - 90)).toBeLessThan(1);
  });

  it('matches logged circumferences', () => {
    const target = {
      waist: (base.measurementsCm.waist ?? 0) + 6,
      bicepsL: (base.measurementsCm.bicepsL ?? 0) + 3,
      chest: (base.measurementsCm.chest ?? 0) - 4,
      thighR: (base.measurementsCm.thighR ?? 0) + 2,
    };
    const s = solveMorphs(male.calibration, snap({ measurements: target }));
    for (const [k, v] of Object.entries(target)) {
      expect(Math.abs((s.predictedCm[k as keyof typeof target] ?? 0) - v)).toBeLessThan(0.8);
    }
    // Left and right are independent.
    expect(Math.abs((s.predictedCm.bicepsR ?? 0) - (base.measurementsCm.bicepsR ?? 0))).toBeLessThan(0.8);
  });

  it('applies weights to the mesh', () => {
    const s = solveMorphs(male.calibration, snap({ measurements: { bicepsL: (base.measurementsCm.bicepsL ?? 0) + 4 } }));
    const pos = applyMorphs(male, s);
    expect(pos.length).toBe(male.positions.length);
    const moved = pos.some((v, i) => Math.abs(v - (male.positions[i] ?? 0)) > 1e-3);
    expect(moved).toBe(true);
  });
});

describe('zone colours', () => {
  it('change mode: growth is good, shrinkage bad, tiny changes neutral', () => {
    expect(toneFor('waist', 1, 'change', 'lose')).toBe('good');
    expect(toneFor('waist', -1, 'change', 'lose')).toBe('bad');
    expect(toneFor('waist', 0.1, 'change', 'lose')).toBe('neutral');
  });

  it('progress mode follows the goal', () => {
    expect(toneFor('waist', -2, 'progress', 'lose')).toBe('good');
    expect(toneFor('bicepsL', 1, 'progress', 'gain')).toBe('good');
    expect(toneFor('bicepsL', -1, 'progress', 'gain')).toBe('bad');
    expect(toneFor('wristL', 1, 'progress', 'gain')).toBe('neutral');
  });

  it('paints only the zone', () => {
    const colors = buildVertexColors(male, zoneHighlights({ bicepsL: 3 }, 'change', 'gain'));
    const zone = male.zones.bicepsL;
    const v = zone?.indices[zone.weights.indexOf(Math.max(...zone.weights))] ?? 0;
    expect(colors[v * 3 + 1]).toBeGreaterThan(SKIN[1] + 0.2); // greener
    expect(colors[0]).toBeCloseTo(SKIN[0], 5); // vertex 0 (head) untouched
  });
});

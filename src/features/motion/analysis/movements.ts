/**
 * Is a machine's resistance profile right for the muscle it's meant to train?
 *
 * Each movement has a strength curve: where in the range of motion a person is strongest. A
 * machine fits when its resistance follows that curve (heavy where you're strong, lighter
 * where you're weak), so the muscle works hard over the whole range instead of being limited
 * by its weakest point. The curves here are the textbook shapes for each movement, not
 * measurements of one person, so the fit is a guide, not a verdict.
 *
 * x = 0 is the start of the lift, which for these movements is where the target muscle is
 * longest (stretched); x = 1 is the end, where it's shortest.
 */
import { mean } from '@/features/motion/analysis/signal';
import { thirds, type ProfileShape } from '@/features/motion/analysis/machine';

export type MovementId =
  | 'chestPress'
  | 'shoulderPress'
  | 'legPress'
  | 'row'
  | 'pulldown'
  | 'chestFly'
  | 'bicepsCurl'
  | 'tricepsExtension'
  | 'legExtension'
  | 'legCurl'
  | 'lateralRaise'
  | 'other';

export type MuscleId =
  'chest' | 'shoulders' | 'triceps' | 'quads' | 'glutes' | 'back' | 'lats' | 'biceps' | 'hamstrings';

export interface Movement {
  id: MovementId;
  muscles: MuscleId[];
  /** The movement's strength curve; null when unknown ("other"). */
  curve: Exclude<ProfileShape, 'valley'> | null;
}

export const MOVEMENTS: Movement[] = [
  // Pressing: strongest near lockout.
  { id: 'chestPress', muscles: ['chest', 'shoulders', 'triceps'], curve: 'ascending' },
  { id: 'shoulderPress', muscles: ['shoulders', 'triceps'], curve: 'ascending' },
  { id: 'legPress', muscles: ['quads', 'glutes'], curve: 'ascending' },
  // Pulling: strongest at the start, weakest fully contracted.
  { id: 'row', muscles: ['back', 'lats', 'biceps'], curve: 'descending' },
  { id: 'pulldown', muscles: ['lats', 'biceps'], curve: 'descending' },
  { id: 'chestFly', muscles: ['chest'], curve: 'descending' },
  { id: 'legCurl', muscles: ['hamstrings'], curve: 'descending' },
  // Single-joint: strongest in the middle.
  { id: 'bicepsCurl', muscles: ['biceps'], curve: 'bell' },
  { id: 'tricepsExtension', muscles: ['triceps'], curve: 'bell' },
  { id: 'legExtension', muscles: ['quads'], curve: 'bell' },
  // Even tension through the range.
  { id: 'lateralRaise', muscles: ['shoulders'], curve: 'flat' },
  { id: 'other', muscles: [], curve: null },
];

export const movementById = (id: string): Movement =>
  MOVEMENTS.find((m) => m.id === id) ?? MOVEMENTS[MOVEMENTS.length - 1]!;

/** The reference curve at x (0–1), 0–1 of its own peak. */
export function referenceAt(curve: NonNullable<Movement['curve']>, x: number): number {
  switch (curve) {
    case 'ascending':
      return 0.6 + 0.4 * x;
    case 'descending':
      return 1 - 0.4 * x;
    case 'bell':
      return 0.6 + 0.4 * Math.sin(Math.PI * x);
    case 'flat':
      return 1;
  }
}

export const referenceCurve = (curve: NonNullable<Movement['curve']>, steps: number) =>
  Array.from({ length: steps }, (_, k) => referenceAt(curve, k / (steps - 1)));

export type FitNote =
  /** Stays heavy where the muscle is stretched. */
  | 'heavyWhenStretched'
  /** Little resistance where the muscle is stretched. */
  | 'lightWhenStretched'
  /** Resistance falls away at the end of the lift. */
  | 'fadesAtEnd'
  /** Heaviest right at the end, where the muscle is shortest. */
  | 'heaviestAtEnd'
  /** Peaks earlier than the movement's strength curve. */
  | 'peaksEarly'
  /** Peaks later than the movement's strength curve. */
  | 'peaksLate'
  /** Almost the same resistance everywhere. */
  | 'even';

export interface MachineFit {
  /** 0–1: how closely the machine follows the movement's strength curve; null without one. */
  match: number | null;
  verdict: 'good' | 'fair' | 'poor' | 'unknown';
  notes: FitNote[];
}

export const GOOD_MATCH = 0.75;
export const FAIR_MATCH = 0.5;

export function fitMachine(profile: readonly number[], movementId: string): MachineFit {
  const movement = movementById(movementId);
  const [first, , last] = thirds(profile);
  const lowest = Math.min(...profile);
  const peakAt = profile.indexOf(Math.max(...profile)) / Math.max(1, profile.length - 1);

  const notes: FitNote[] = [];
  if (1 - lowest < 0.15) notes.push('even');
  if (first >= 0.8) notes.push('heavyWhenStretched');
  else if (first < 0.55) notes.push('lightWhenStretched');
  if (last < 0.6) notes.push('fadesAtEnd');
  else if (peakAt > 0.9 && last - first > 0.2) notes.push('heaviestAtEnd');

  if (!movement.curve) return { match: null, verdict: 'unknown', notes };

  const reference = referenceCurve(movement.curve, profile.length);
  // Average gap between the two curves; 0.35 apart everywhere counts as no match at all.
  const gap = mean(profile.map((v, k) => Math.abs(v - reference[k]!)));
  const match = Math.max(0, Math.min(1, 1 - gap / 0.35));

  if (movement.curve !== 'flat') {
    const referencePeak = reference.indexOf(Math.max(...reference)) / (reference.length - 1);
    if (peakAt < referencePeak - 0.3) notes.push('peaksEarly');
    else if (peakAt > referencePeak + 0.3) notes.push('peaksLate');
  }

  return {
    match,
    verdict: match >= GOOD_MATCH ? 'good' : match >= FAIR_MATCH ? 'fair' : 'poor',
    notes,
  };
}

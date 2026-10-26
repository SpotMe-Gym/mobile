import { useCallback } from 'react';
import { useBodyStore } from '@/features/body/bodyStore';
import { useWeightStore } from '@/features/body-weight/weightStore';
import { isDayKey, type DayKey } from '@/shared/utils/date';
import type { BiaReport, BodySegment, SegmentComposition } from '@/features/body/types';

/**
 * BIA (bioelectrical impedance) import pipeline — the extension point for smart-scale data.
 *
 *   file / API payload ──BiaImporter.parse──► BiaInput[] ──validateBia──► bodyStore.biaReports
 *                                                                      └► weightStore (if weight)
 *
 * Nothing else changes when an importer is added: snapshots pick up the latest report as
 * `composition`, solveMorphs turns skeletal muscle mass into the muscle macro, and
 * segmentDeltas / segmentHighlights colour arms, legs and trunk from segmental lean / fat.
 */

export type BiaInput = Omit<BiaReport, 'id' | 'source' | 'createdAt' | 'day'> & { day: DayKey };

export interface BiaImporter {
  /** Stable id, e.g. 'inbody-csv', 'withings-api'. */
  id: string;
  /** Cheap sniffing so the UI can pick the importer for a file. */
  canParse(raw: string): boolean;
  parse(raw: string): BiaInput[];
}

/** Register importers here (InBody CSV, Tanita, Withings, Apple Health…). */
export const BIA_IMPORTERS: BiaImporter[] = [];

const inRange = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

const pickRange = (v: unknown, min: number, max: number): number | undefined => (inRange(v, min, max) ? v : undefined);

function cleanSegment(s: SegmentComposition | undefined): SegmentComposition | undefined {
  if (!s) return undefined;
  const leanKg = pickRange(s.leanKg, 0, 80);
  const fatKg = pickRange(s.fatKg, 0, 80);
  return leanKg === undefined && fatKg === undefined ? undefined : { leanKg, fatKg };
}

/** Drops implausible fields; returns null when nothing usable is left. */
export function validateBia(input: BiaInput): BiaInput | null {
  if (!isDayKey(input.day)) return null;
  const segmental: Partial<Record<BodySegment, SegmentComposition>> = {};
  for (const seg of ['armL', 'armR', 'trunk', 'legL', 'legR'] as const) {
    const s = cleanSegment(input.segmental?.[seg]);
    if (s) segmental[seg] = s;
  }
  const out: BiaInput = {
    day: input.day,
    device: typeof input.device === 'string' ? input.device.slice(0, 60) : undefined,
    weightKg: pickRange(input.weightKg, 20, 350),
    bodyFatPct: pickRange(input.bodyFatPct, 2, 75),
    fatMassKg: pickRange(input.fatMassKg, 0, 250),
    skeletalMuscleKg: pickRange(input.skeletalMuscleKg, 5, 120),
    visceralFatLevel: pickRange(input.visceralFatLevel, 1, 60),
    totalBodyWaterL: pickRange(input.totalBodyWaterL, 10, 120),
    ecwRatio: pickRange(input.ecwRatio, 0.2, 0.6),
    basalMetabolicRateKcal: pickRange(input.basalMetabolicRateKcal, 500, 5000),
    segmental: Object.keys(segmental).length > 0 ? segmental : undefined,
  };
  const { day: _day, device: _device, ...metrics } = out;
  return Object.values(metrics).some((v) => v !== undefined) ? out : null;
}

/** Stores validated reports; a report's weight also lands in the weight log. Returns how many were kept. */
export function useBiaImport() {
  const addBiaReport = useBodyStore((s) => s.addBiaReport);
  const addWeight = useWeightStore((s) => s.addEntry);
  return useCallback(
    (inputs: readonly BiaInput[]) => {
      let kept = 0;
      for (const raw of inputs) {
        const report = validateBia(raw);
        if (!report) continue;
        addBiaReport(report);
        if (report.weightKg !== undefined) addWeight(report.weightKg, report.day);
        kept++;
      }
      return kept;
    },
    [addBiaReport, addWeight],
  );
}

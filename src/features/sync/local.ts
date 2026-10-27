/**
 * Reads the app's stores as wire rows and writes remote changes back into them.
 * Writes made here are flagged, so they don't trigger another sync.
 */
import { useWeightStore, type WeightEntry } from '@/features/body-weight/weightStore';
import { useBodyStore } from '@/features/body/bodyStore';
import type { BiaReport, MeasurementEntry } from '@/features/body/types';
import { useNutritionStore, type LogEntry } from '@/features/nutrition/nutritionStore';
import { scheduledDays, useWorkoutStore, withDays } from '@/features/workouts/workoutStore';
import { useUserStore } from '@/features/profile/userStore';
import {
  biaFromRow,
  biaToWire,
  foodFromRow,
  foodToWire,
  measurementFromRow,
  measurementToWire,
  profileToWire,
  weightFromRow,
  weightToWire,
  workoutFromRow,
  workoutToWire,
  type LocalProfile,
  type ProfileWire,
  type SyncTable,
} from '@/features/sync/wire';

type Wire = { client_id: string } & Record<string, unknown>;
export type LocalWires = Record<SyncTable, Map<string, Wire>>;
export type RemoteChanges = Partial<Record<SyncTable, { upserts: Wire[]; deletes: string[] }>>;

let applying = 0;
/** True while sync writes into the stores (store listeners ignore those changes). */
export const isApplyingRemote = () => applying > 0;

const byId = <T extends { client_id: string }>(rows: T[]) =>
  new Map(rows.map((r) => [r.client_id, r as unknown as Wire]));

export function readLocal(): LocalWires {
  const { entries } = useWeightStore.getState();
  const { measurements, biaReports } = useBodyStore.getState();
  const { days } = useNutritionStore.getState();
  const { workouts, schedule } = useWorkoutStore.getState();
  return {
    weight_entries: byId(entries.map(weightToWire)),
    measurement_entries: byId(measurements.map(measurementToWire)),
    bia_reports: byId(biaReports.map(biaToWire)),
    food_entries: byId(Object.entries(days).flatMap(([day, list]) => list.map((e) => foodToWire(e, day)))),
    workouts: byId(workouts.map((w) => workoutToWire(w, scheduledDays(schedule, w.id)))),
  };
}

export function readLocalProfile(): LocalProfile {
  const s = useUserStore.getState();
  return {
    name: s.name,
    gender: s.gender,
    heightCm: s.heightCm,
    age: s.age,
    activityLevel: s.activityLevel,
    goal: s.goal,
    targets: s.targets,
    units: s.units,
  };
}

export const localProfileWire = (): ProfileWire => profileToWire(readLocalProfile());

const sortByDay = <T extends { day: string; createdAt: string }>(a: T, b: T) =>
  a.day === b.day ? a.createdAt.localeCompare(b.createdAt) : a.day.localeCompare(b.day);

function merge<T extends { id: string }>(
  list: readonly T[],
  upserts: readonly T[],
  deletes: readonly string[],
): T[] {
  const map = new Map(list.map((x) => [x.id, x]));
  for (const id of deletes) map.delete(id);
  for (const x of upserts) map.set(x.id, x);
  return [...map.values()];
}

export function applyRemote(changes: RemoteChanges, profile?: LocalProfile): void {
  applying++;
  try {
    const w = changes.weight_entries;
    if (w && (w.upserts.length || w.deletes.length)) {
      useWeightStore.setState((s) => ({
        entries: merge<WeightEntry>(s.entries, w.upserts.map(weightFromRow), w.deletes).sort(sortByDay),
      }));
    }

    const m = changes.measurement_entries;
    const b = changes.bia_reports;
    if ((m && (m.upserts.length || m.deletes.length)) || (b && (b.upserts.length || b.deletes.length))) {
      useBodyStore.setState((s) => ({
        measurements: m
          ? merge<MeasurementEntry>(s.measurements, m.upserts.map(measurementFromRow), m.deletes).sort(
              sortByDay,
            )
          : s.measurements,
        biaReports: b
          ? merge<BiaReport>(s.biaReports, b.upserts.map(biaFromRow), b.deletes).sort(sortByDay)
          : s.biaReports,
      }));
    }

    const f = changes.food_entries;
    if (f && (f.upserts.length || f.deletes.length)) {
      useNutritionStore.setState((s) => {
        const incoming = f.upserts.map(foodFromRow);
        const drop = new Set([...f.deletes, ...incoming.map((x) => x.entry.id)]);
        const days: Record<string, LogEntry[]> = {};
        for (const [day, list] of Object.entries(s.days)) {
          const kept = list.filter((e) => !drop.has(e.id));
          if (kept.length) days[day] = kept;
        }
        for (const { day, entry } of incoming) days[day] = [...(days[day] ?? []), entry];
        for (const { day } of incoming)
          days[day] = [...(days[day] ?? [])].sort((a, z) => a.loggedAt.localeCompare(z.loggedAt));
        return { days };
      });
    }

    const wk = changes.workouts;
    if (wk && (wk.upserts.length || wk.deletes.length)) {
      useWorkoutStore.setState((s) => {
        const incoming = wk.upserts.map(workoutFromRow);
        let schedule = s.schedule;
        for (const id of wk.deletes) schedule = withDays(schedule, id, []);
        for (const { workout, weekdays } of incoming) schedule = withDays(schedule, workout.id, weekdays);
        return {
          workouts: merge(
            s.workouts,
            incoming.map((x) => x.workout),
            wk.deletes,
          ),
          schedule,
        };
      });
    }

    if (profile) {
      useUserStore.setState({
        name: profile.name,
        gender: profile.gender,
        heightCm: profile.heightCm,
        age: profile.age,
        activityLevel: profile.activityLevel,
        goal: profile.goal,
        targets: profile.targets,
        units: profile.units,
      });
    }
  } finally {
    applying--;
  }
}

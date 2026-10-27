import { Share } from 'react-native';
import Constants from 'expo-constants';
import { useUserStore } from '@/features/profile/userStore';
import { useWeightStore } from '@/features/body-weight/weightStore';
import { useNutritionStore } from '@/features/nutrition/nutritionStore';
import { useWorkoutStore } from '@/features/workouts/workoutStore';
import { useBodyStore } from '@/features/body/bodyStore';
import { useDashboardStore, DEFAULT_WIDGETS } from '@/features/dashboard/dashboardStore';
import { reportError } from '@/shared/lib/reporting';
import { turnSyncOff } from '@/features/sync/syncStore';

/** Everything the app stores about the user, as one portable JSON document. */
export function buildExport() {
  const pick = <T extends object>(state: T) =>
    Object.fromEntries(Object.entries(state).filter(([, v]) => typeof v !== 'function'));
  return {
    app: 'SpotMe',
    version: Constants.expoConfig?.version ?? 'unknown',
    exportedAt: new Date().toISOString(),
    profile: pick(useUserStore.getState()),
    weight: pick(useWeightStore.getState()),
    nutrition: pick(useNutritionStore.getState()),
    workouts: pick(useWorkoutStore.getState()),
    body: pick(useBodyStore.getState()),
    dashboard: pick(useDashboardStore.getState()),
  };
}

/** Right of access / portability: hand the user their data via the system share sheet. */
export async function shareExport(): Promise<void> {
  try {
    await Share.share({ title: 'SpotMe export', message: JSON.stringify(buildExport(), null, 2) });
  } catch (error) {
    reportError(error, { context: 'shareExport' });
    throw error;
  }
}

/**
 * Right to erasure on this device: wipes every store (each persists its own reset). Sync is
 * turned off FIRST, so the wipe never reaches the account (deleting that is done on the website).
 */
export function eraseAllData(): void {
  turnSyncOff();
  useNutritionStore.getState().reset();
  useWeightStore.getState().reset();
  useWorkoutStore.getState().reset();
  useBodyStore.getState().reset();
  useDashboardStore.setState({ widgets: DEFAULT_WIDGETS });
  useUserStore.getState().resetUser(); // last: flips the onboarding guard
}

import { Share } from 'react-native';
import Constants from 'expo-constants';
import { useUserStore } from '@/store/userStore';
import { useWeightStore } from '@/store/weightStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useDashboardStore, DEFAULT_WIDGETS } from '@/store/dashboardStore';
import { reportError } from './reporting';

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

/** Right to erasure: wipes every store (each persists its own reset). */
export function eraseAllData(): void {
  useNutritionStore.getState().reset();
  useWeightStore.getState().reset();
  useWorkoutStore.getState().reset();
  useDashboardStore.setState({ widgets: DEFAULT_WIDGETS });
  useUserStore.getState().resetUser(); // last: flips the onboarding guard
}

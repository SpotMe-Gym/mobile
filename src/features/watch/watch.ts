import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WatchModule, type WatchCommand, type WatchStatus } from '../../../modules/spotme-watch';
import { publishHeartRate } from '@/features/heartRate/heartRateBus';
import { useHeartRateStore } from '@/features/heartRate/heartRateStore';
import type { WatchState } from '@/features/watch/watchState';

export { watchAvailable } from '../../../modules/spotme-watch';
export type { WatchCommand, WatchStatus };

/** Whether to open SpotMe on the watch when a workout starts. */
export const useWatchPrefs = create<{ enabled: boolean; setEnabled: (v: boolean) => void }>()(
  persist((set) => ({ enabled: true, setEnabled: (enabled) => set({ enabled }) }), {
    name: 'watch-prefs',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

// Heart rate and connection from the watch feed the same pipeline as a Bluetooth strap.
if (WatchModule) {
  WatchModule.addListener('onHeartRate', ({ bpm, at }) => publishHeartRate(bpm, at, 'watch'));
  WatchModule.addListener('onWatchState', ({ connected }) => {
    useHeartRateStore.getState().set({ watchConnected: connected });
  });
}

export async function watchStatus(): Promise<WatchStatus | null> {
  if (!WatchModule) return null;
  try {
    return await WatchModule.status();
  } catch {
    return null;
  }
}

/** Asks for Apple Health access (heart rate, workouts). */
export async function allowAppleHealth(): Promise<boolean> {
  if (!WatchModule) return false;
  try {
    return await WatchModule.requestAuthorization();
  } catch {
    return false;
  }
}

/** Opens SpotMe on the paired watch with a strength workout. False when there's no watch app. */
export async function startWatchWorkout(): Promise<boolean> {
  if (!WatchModule || !useWatchPrefs.getState().enabled) return false;
  const status = await watchStatus();
  if (!status?.healthAvailable || !status.isPaired || !status.isWatchAppInstalled || status.connected)
    return false;
  try {
    await WatchModule.requestAuthorization();
    return await WatchModule.startWorkout();
  } catch {
    return false;
  }
}

export function sendWatchState(state: WatchState) {
  if (!WatchModule || !useHeartRateStore.getState().watchConnected) return;
  void WatchModule.send(JSON.stringify({ type: 'state', state })).catch(() => undefined);
}

/** Ends the workout on the watch (it saves it to Apple Health). */
export function endWatchWorkout() {
  if (!WatchModule) return;
  void WatchModule.endWorkout().catch(() => undefined);
}

/** Button presses on the watch (returns an unsubscribe). */
export function onWatchCommand(listener: (command: WatchCommand) => void): () => void {
  if (!WatchModule) return () => undefined;
  const sub = WatchModule.addListener('onCommand', ({ command }) => listener(command));
  return () => sub.remove();
}

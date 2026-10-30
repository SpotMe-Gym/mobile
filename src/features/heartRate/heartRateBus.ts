import { useHeartRateStore } from '@/features/heartRate/heartRateStore';

/**
 * One stream of heart rate readings, whatever measures it: a Bluetooth strap or the SpotMe
 * Apple Watch app. The store shows the latest; listeners (the workout in progress) record it.
 */
export type HeartRateSource = 'ble' | 'watch';
type Listener = (bpm: number, at: number, source: HeartRateSource) => void;

const listeners = new Set<Listener>();

export function publishHeartRate(
  bpm: number,
  at: number,
  source: HeartRateSource,
  contact: boolean | null = null,
) {
  if (!Number.isFinite(bpm) || bpm <= 0) return;
  useHeartRateStore.getState().set({ bpm: Math.round(bpm), at, contact, source });
  for (const l of listeners) l(Math.round(bpm), at, source);
}

/** Every reading (returns an unsubscribe). */
export function onHeartRate(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

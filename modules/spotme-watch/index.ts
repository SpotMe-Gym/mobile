import { Platform } from 'react-native';
import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';

/**
 * The SpotMe Apple Watch app, seen from the iPhone. The phone starts the watch app with an
 * Apple Health workout; the watch mirrors that workout back, sending heart rate and button
 * presses, and receives what the player shows. iPhone only; null in Expo Go and tests.
 */
export interface WatchStatus {
  /** Health data on this device (false on iPad). */
  healthAvailable: boolean;
  isPaired: boolean;
  isWatchAppInstalled: boolean;
  /** A mirrored workout from the watch is running now. */
  connected: boolean;
}

export type WatchCommand = 'done' | 'pause' | 'resume' | 'skip';

type Events = {
  onHeartRate: (e: { bpm: number; at: number }) => void;
  onCommand: (e: { command: WatchCommand }) => void;
  onWatchState: (e: { connected: boolean }) => void;
};

interface NativeModule {
  status(): Promise<WatchStatus>;
  requestAuthorization(): Promise<boolean>;
  startWorkout(): Promise<boolean>;
  /** JSON: { type: 'state', state: {…} }. */
  send(json: string): Promise<void>;
  endWorkout(): Promise<void>;
  addListener<E extends keyof Events>(event: E, listener: Events[E]): EventSubscription;
}

const native = Platform.OS === 'ios' ? requireOptionalNativeModule<NativeModule>('SpotmeWatch') : null;

export const WatchModule = native;
export const watchAvailable = native !== null;

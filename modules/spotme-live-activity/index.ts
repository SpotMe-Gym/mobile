import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * The workout on the Lock Screen and in the Dynamic Island (iOS Live Activity).
 * iPhone only; null on Android, in Expo Go and in tests.
 */
export interface LiveState {
  /** The exercise (during a rest: the one coming up). */
  title: string;
  /** "Set 2 of 4 · Rest". */
  subtitle: string;
  isRest: boolean;
  /** When a countdown ends (ms); absent for a reps set, which counts up from `startedAt`. */
  endsAt?: number;
  startedAt: number;
  paused: boolean;
  /** The time shown while paused ("0:42"). */
  pausedText?: string;
  next?: string;
  heartRate?: number;
  /** Shown once the countdown has run out while the app is suspended: the step that follows. */
  afterTitle?: string;
  afterSubtitle?: string;
  afterIsRest?: boolean;
}

interface NativeModule {
  isEnabled(): boolean;
  show(workoutName: string, stateJson: string): Promise<boolean>;
  end(): Promise<void>;
}

export const LiveActivityModule =
  Platform.OS === 'ios' ? requireOptionalNativeModule<NativeModule>('SpotmeLiveActivity') : null;

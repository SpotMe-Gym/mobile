import { Platform } from 'react-native';
import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';

/**
 * Motion Lab's video tracker (Apple Vision, on the device). Follows the points marked on the
 * first frame and the body's joints through a recorded video.
 *
 * iPhone only for now; null on Android, in Expo Go and in tests.
 */
export interface FrameInfo {
  /** file:// JPEG in the app's storage. */
  uri: string;
  width: number;
  height: number;
  /** Length of the video in seconds. */
  duration: number;
}

export interface AnalyzeOptions {
  /** Marked points as [x, y], 0–1 of the frame from the top-left. */
  points: [number, number][];
  /** Side of the tracked square, as a share of the frame's short side (default 0.06). */
  box?: number;
  /** Frames analysed per second (default 15). */
  fps?: number;
  /** Also find the body's joints. */
  pose?: boolean;
  start?: number;
  end?: number;
}

type Events = {
  onProgress: (e: { fraction: number }) => void;
};

interface NativeModule {
  frame(uri: string, atSeconds: number, name: string): Promise<FrameInfo>;
  /** JSON of a Track (see src/features/motion/analysis/track.ts). */
  analyze(uri: string, optionsJson: string): Promise<string>;
  remove(uri: string): Promise<void>;
  addListener<E extends keyof Events>(event: E, listener: Events[E]): EventSubscription;
}

const native = Platform.OS === 'ios' ? requireOptionalNativeModule<NativeModule>('SpotmeMotion') : null;

export const MotionModule = native;
export const motionAvailable = native !== null;

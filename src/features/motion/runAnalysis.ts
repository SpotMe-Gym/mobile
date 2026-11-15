import { MotionModule, type FrameInfo } from '../../../modules/spotme-motion';
import { analyzeExecution, type ExecutionResult } from '@/features/motion/analysis/execution';
import { analyzeMachine, type MachineResult } from '@/features/motion/analysis/machine';
import type { Track } from '@/features/motion/analysis/track';
import { newId } from '@/shared/lib/ids';

export type AnalysisError = 'unavailable' | 'noReps' | 'failed';

export class MotionError extends Error {
  constructor(public readonly reason: AnalysisError) {
    super(reason);
  }
}

/** The video's first frame, saved in the app's storage (to mark on, then kept with the result). */
export async function firstFrame(videoUri: string): Promise<FrameInfo> {
  if (!MotionModule) throw new MotionError('unavailable');
  try {
    return await MotionModule.frame(videoUri, 0, newId());
  } catch {
    throw new MotionError('failed');
  }
}

export function discardFrame(uri: string | null | undefined) {
  if (uri) void MotionModule?.remove(uri).catch(() => {});
}

/** Follows the marked points (and the body, for an execution) through the video. */
export async function track(
  videoUri: string,
  points: [number, number][],
  pose: boolean,
  onProgress: (fraction: number) => void,
): Promise<Track> {
  if (!MotionModule) throw new MotionError('unavailable');
  const sub = MotionModule.addListener('onProgress', (e) => onProgress(e.fraction));
  try {
    const json = await MotionModule.analyze(videoUri, JSON.stringify({ points, pose, fps: 15 }));
    const parsed = JSON.parse(json) as Track;
    if (!Array.isArray(parsed.frames) || parsed.frames.length === 0) throw new MotionError('failed');
    return parsed;
  } catch (e) {
    throw e instanceof MotionError ? e : new MotionError('failed');
  } finally {
    sub.remove();
  }
}

export function executionFrom(trackData: Track, startsWithLowering: boolean): ExecutionResult {
  const result = analyzeExecution(trackData, { handle: 0, startsWithLowering });
  if (result.reps.length === 0) throw new MotionError('noReps');
  return result;
}

export function machineFrom(trackData: Track, hasPivot: boolean): MachineResult {
  const result = analyzeMachine(trackData, { handle: 0, load: 1, pivot: hasPivot ? 2 : null });
  if (!result) throw new MotionError('noReps');
  return result;
}

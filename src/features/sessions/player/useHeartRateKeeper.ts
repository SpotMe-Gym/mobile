import { useEffect } from 'react';
import { connectSavedMonitor, refreshMonitor } from '@/features/heartRate/bleHeartRate';
import { useHeartRateStore, type HeartRateStatus } from '@/features/heartRate/heartRateStore';
import { startWatchWorkout } from '@/features/watch/watch';

/** No reading for this long means the source needs a push. */
export const SILENT_MS = 12_000;
const STRAP_RETRY_MS = 15_000;
const WATCH_RETRY_MS = 20_000;

const BLOCKED: readonly HeartRateStatus[] = ['scanning', 'bluetoothOff', 'unauthorized', 'unsupported'];

export interface KeeperState {
  /** When the last reading arrived (ms), from any source. */
  lastReadingAt: number | null;
  hasStrap: boolean;
  status: HeartRateStatus;
  lastStrapAttempt: number;
  lastWatchAttempt: number;
}

/**
 * What to retry right now. While readings arrive, nothing. When they stop (or never started):
 * reconnect the strap and reopen the watch workout, each at its own pace so a device that
 * isn't there doesn't get hammered.
 */
export function keeperActions(s: KeeperState, now: number): { strap: boolean; watch: boolean } {
  if (s.lastReadingAt !== null && now - s.lastReadingAt < SILENT_MS) return { strap: false, watch: false };
  return {
    strap: s.hasStrap && !BLOCKED.includes(s.status) && now - s.lastStrapAttempt >= STRAP_RETRY_MS,
    watch: now - s.lastWatchAttempt >= WATCH_RETRY_MS,
  };
}

/**
 * Keeps heart rate flowing during a workout. Connecting once at the start wasn't enough: a
 * strap that was asleep, or a watch app that opened a few seconds late, stayed silent until
 * the monitor was turned off and on by hand. This does that by itself.
 */
export function useHeartRateKeeper(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let lastStrapAttempt = Date.now();
    let lastWatchAttempt = Date.now(); // useWatchSync opens the watch app at the start
    void connectSavedMonitor();
    const id = setInterval(() => {
      const hr = useHeartRateStore.getState();
      const now = Date.now();
      const todo = keeperActions(
        {
          lastReadingAt: hr.at,
          hasStrap: hr.saved !== null,
          status: hr.status,
          lastStrapAttempt,
          lastWatchAttempt,
        },
        now,
      );
      if (todo.strap) {
        lastStrapAttempt = now;
        void refreshMonitor();
      }
      if (todo.watch) {
        lastWatchAttempt = now;
        void startWatchWorkout();
      }
    }, 3000);
    return () => clearInterval(id);
  }, [active]);
}

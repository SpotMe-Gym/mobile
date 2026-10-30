import { onHeartRate } from '@/features/heartRate/heartRateBus';
import { useHeartRateStore } from '@/features/heartRate/heartRateStore';
import type * as WatchBridge from '@/features/watch/watch';

const listeners: Record<string, (e: never) => void> = {};
const mockModule = {
  status: jest.fn(() =>
    Promise.resolve({ healthAvailable: true, isPaired: true, isWatchAppInstalled: true, connected: false }),
  ),
  requestAuthorization: jest.fn(() => Promise.resolve(true)),
  startWorkout: jest.fn(() => Promise.resolve(true)),
  send: jest.fn(() => Promise.resolve()),
  endWorkout: jest.fn(() => Promise.resolve()),
  addListener: jest.fn((event: string, cb: (e: never) => void) => {
    listeners[event] = cb;
    return { remove: jest.fn() };
  }),
};
jest.mock('../../../modules/spotme-watch', () => ({ WatchModule: mockModule, watchAvailable: true }));

// Loaded after the mock (the bridge subscribes on import).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const watch = require('@/features/watch/watch') as typeof WatchBridge;

describe('Apple Watch bridge', () => {
  it('opens SpotMe on the watch when there is one with the app', async () => {
    expect(await watch.startWatchWorkout()).toBe(true);
    expect(mockModule.requestAuthorization).toHaveBeenCalled();
    expect(mockModule.startWorkout).toHaveBeenCalled();
    watch.useWatchPrefs.getState().setEnabled(false);
    mockModule.startWorkout.mockClear();
    expect(await watch.startWatchWorkout()).toBe(false);
    expect(mockModule.startWorkout).not.toHaveBeenCalled();
    watch.useWatchPrefs.getState().setEnabled(true);
  });

  it('heart rate from the watch goes through the same pipeline as a strap', () => {
    const got: [number, string][] = [];
    const off = onHeartRate((bpm, _at, source) => got.push([bpm, source]));
    listeners.onWatchState!({ connected: true } as never);
    listeners.onHeartRate!({ bpm: 141.6, at: 1 } as never);
    off();
    expect(got).toEqual([[142, 'watch']]);
    expect(useHeartRateStore.getState()).toMatchObject({ bpm: 142, source: 'watch', watchConnected: true });
  });

  it('sends the player state only while the watch is connected, and relays its buttons', () => {
    const state = {
      exercise: 'Squat',
      set: 'Set 1 of 3',
      phase: 'Rest',
      isRest: true,
      startedAt: 0,
      paused: false,
      labels: { done: 'Done', pause: 'Pause', resume: 'Resume', skip: 'Skip' },
    };
    watch.sendWatchState(state);
    expect(mockModule.send).toHaveBeenCalledWith(JSON.stringify({ type: 'state', state }));
    listeners.onWatchState!({ connected: false } as never);
    mockModule.send.mockClear();
    watch.sendWatchState(state);
    expect(mockModule.send).not.toHaveBeenCalled();

    const commands: string[] = [];
    const off = watch.onWatchCommand((c) => commands.push(c));
    listeners.onCommand!({ command: 'done' } as never);
    off();
    expect(commands).toEqual(['done']);
  });
});

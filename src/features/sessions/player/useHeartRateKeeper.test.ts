import { keeperActions, type KeeperState } from '@/features/sessions/player/useHeartRateKeeper';

const NOW = 1_000_000;
const base: KeeperState = {
  lastReadingAt: null,
  hasStrap: true,
  status: 'connected',
  lastStrapAttempt: NOW - 60_000,
  lastWatchAttempt: NOW - 60_000,
};

describe('heart rate keeper', () => {
  it('leaves everything alone while readings arrive', () => {
    expect(keeperActions({ ...base, lastReadingAt: NOW - 3000 }, NOW)).toEqual({
      strap: false,
      watch: false,
    });
  });

  it('retries both sources when they have gone silent, or never started', () => {
    expect(keeperActions(base, NOW)).toEqual({ strap: true, watch: true });
    expect(keeperActions({ ...base, lastReadingAt: NOW - 20_000 }, NOW)).toEqual({
      strap: true,
      watch: true,
    });
  });

  it('paces the retries, and skips a strap that cannot connect', () => {
    expect(
      keeperActions({ ...base, lastStrapAttempt: NOW - 5000, lastWatchAttempt: NOW - 5000 }, NOW),
    ).toEqual({
      strap: false,
      watch: false,
    });
    expect(keeperActions({ ...base, hasStrap: false }, NOW).strap).toBe(false);
    expect(keeperActions({ ...base, status: 'bluetoothOff' }, NOW).strap).toBe(false);
  });
});

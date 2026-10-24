// Runs in Europe/Rome (UTC+1/+2) — see jest.global-setup.js.
import { fromDayKey, isoWeekday, msUntilNextDay, toDayKey } from '@/utils/date';

describe('toDayKey', () => {
  it('uses the local civil day, not UTC, just after midnight', () => {
    // 00:30 on 24 Oct in Rome is still 23 Oct in UTC — toISOString() would say the 23rd.
    const justAfterMidnight = new Date(2026, 9, 24, 0, 30);
    expect(justAfterMidnight.toISOString().startsWith('2026-10-23')).toBe(true);
    expect(toDayKey(justAfterMidnight)).toBe('2026-10-24');
  });

  it('round-trips through fromDayKey at local midnight', () => {
    const d = fromDayKey('2026-03-29'); // DST switch day in Europe
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(29);
    expect(d.getHours()).toBe(0);
    expect(toDayKey(d)).toBe('2026-03-29');
  });
});

describe('isoWeekday', () => {
  it('maps Monday to 1 and Sunday to 7', () => {
    expect(isoWeekday(new Date(2024, 0, 1))).toBe(1); // Monday
    expect(isoWeekday(new Date(2024, 0, 7))).toBe(7); // Sunday
  });
});

describe('msUntilNextDay', () => {
  it('counts to the next local midnight', () => {
    expect(msUntilNextDay(new Date(2026, 9, 24, 23, 0))).toBe(60 * 60 * 1000);
  });
});

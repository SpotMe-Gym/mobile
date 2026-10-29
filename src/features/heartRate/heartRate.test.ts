import { heartRateZone, isUuid, maxHeartRate, parseHeartRate } from '@/features/heartRate/heartRate';

describe('heart rate measurement', () => {
  it('reads 8-bit and 16-bit values, contact and RR intervals', () => {
    expect(parseHeartRate([0x00, 72])).toEqual({ bpm: 72, contact: null, rr: [] });
    expect(parseHeartRate([0x06, 130])).toEqual({ bpm: 130, contact: true, rr: [] });
    expect(parseHeartRate([0x04, 130])).toMatchObject({ contact: false });
    expect(parseHeartRate([0x01, 0x2c, 0x01])).toMatchObject({ bpm: 300 });
    // 8-bit bpm + RR 1024/1024 s = 1000 ms
    expect(parseHeartRate([0x10, 60, 0x00, 0x04])).toEqual({ bpm: 60, contact: null, rr: [1000] });
    // energy expended (2 bytes) before the RR values
    expect(parseHeartRate([0x18, 60, 9, 9, 0x00, 0x02])).toMatchObject({ rr: [500] });
    expect(parseHeartRate([0x01, 5])).toBeNull();
    expect(parseHeartRate([])).toBeNull();
  });

  it('zones from the estimated max', () => {
    expect(maxHeartRate(30)).toBe(187);
    expect(maxHeartRate(null)).toBe(190);
    expect(heartRateZone(100, 190)).toBe(1);
    expect(heartRateZone(135, 190)).toBe(3);
    expect(heartRateZone(175, 190)).toBe(5);
  });

  it('matches short and full UUIDs', () => {
    expect(isUuid('0000180d-0000-1000-8000-00805f9b34fb', '180D')).toBe(true);
    expect(isUuid('2a37', '2A37')).toBe(true);
    expect(isUuid('180f', '180D')).toBe(false);
  });
});

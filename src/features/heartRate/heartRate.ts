/**
 * Bluetooth heart rate, the standard way: the Heart Rate service (0x180D) with its
 * Measurement characteristic (0x2A37). Every chest strap and armband speaks it (Polar, Garmin,
 * Wahoo, Coros…), as do many watches in their "broadcast heart rate" mode. No account or
 * vendor SDK needed.
 */
export const HR_SERVICE = '180D';
export const HR_MEASUREMENT = '2A37';

export interface HeartRateReading {
  bpm: number;
  /** null when the sensor doesn't report skin contact. */
  contact: boolean | null;
  /** Beat-to-beat intervals in ms, when sent. */
  rr: number[];
}

/** Decodes a Heart Rate Measurement value (Bluetooth GATT spec 3.106). */
export function parseHeartRate(bytes: readonly number[]): HeartRateReading | null {
  if (bytes.length < 2) return null;
  const flags = bytes[0]!;
  const wide = (flags & 0x01) !== 0;
  const contactSupported = (flags & 0x04) !== 0;
  const energy = (flags & 0x08) !== 0;
  const hasRr = (flags & 0x10) !== 0;
  let i = 1;
  let bpm: number;
  if (wide) {
    if (bytes.length < 3) return null;
    bpm = bytes[1]! | (bytes[2]! << 8);
    i = 3;
  } else {
    bpm = bytes[1]!;
    i = 2;
  }
  if (energy) i += 2;
  const rr: number[] = [];
  if (hasRr) {
    for (; i + 1 < bytes.length; i += 2)
      rr.push(Math.round(((bytes[i]! | (bytes[i + 1]! << 8)) / 1024) * 1000));
  }
  return { bpm, contact: contactSupported ? (flags & 0x02) !== 0 : null, rr };
}

/** Max heart rate estimate (Tanaka: 208 − 0.7 × age); 190 without an age. */
export const maxHeartRate = (age: number | null | undefined) =>
  age && age > 5 && age < 110 ? Math.round(208 - 0.7 * age) : 190;

export type HeartRateZone = 1 | 2 | 3 | 4 | 5;

/** Zones at 50 / 60 / 70 / 80 / 90 % of max (below 50 % counts as zone 1). */
export function heartRateZone(bpm: number, max: number): HeartRateZone {
  const pct = bpm / max;
  if (pct >= 0.9) return 5;
  if (pct >= 0.8) return 4;
  if (pct >= 0.7) return 3;
  if (pct >= 0.6) return 2;
  return 1;
}

/** Same UUID whatever form the platform reports ("180d", "0000180d-0000-1000-8000-00805f9b34fb"). */
export const isUuid = (uuid: string, short: string) => {
  const u = uuid.toLowerCase();
  const s = short.toLowerCase();
  return u === s || u === `0000${s}-0000-1000-8000-00805f9b34fb`;
};

/**
 * Numeric input helpers. iOS/Android decimal keypads show the LOCALE separator, so an
 * Italian user types "72,5". parseFloat('72,5') === 72 — always go through parseDecimal.
 */

/** Accepts both "." and "," as decimal separator. Returns null for empty/invalid input. */
export function parseDecimal(text: string): number | null {
  const normalised = text.trim().replace(/\s/g, '').replace(',', '.');
  if (normalised === '' || normalised === '.' || normalised === '-') return null;
  if (!/^-?\d*\.?\d*$/.test(normalised)) return null;
  const value = Number(normalised);
  return Number.isFinite(value) ? value : null;
}

/**
 * Filters keystrokes for a decimal field: keeps digits and at most one separator
 * (either "." or ","), limited to `maxDecimals` fraction digits. Returns null when the
 * keystroke should be rejected, so callers keep the previous text (no cursor jump).
 */
export function sanitizeDecimalInput(text: string, maxDecimals = 1): string | null {
  if (text === '') return '';
  const re = new RegExp(`^\\d*([.,]\\d{0,${maxDecimals}})?$`);
  return re.test(text) ? text : null;
}

export function sanitizeIntegerInput(text: string): string | null {
  return /^\d*$/.test(text) ? text : null;
}

export function formatNumber(value: number, locale: string, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits, minimumFractionDigits: 0 }).format(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

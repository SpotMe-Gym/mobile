import { formatNumber, parseDecimal, sanitizeDecimalInput, sanitizeIntegerInput } from '@/utils/number';

describe('parseDecimal', () => {
  it.each([
    ['72,5', 72.5],
    ['72.5', 72.5],
    [' 80 ', 80],
    ['0,25', 0.25],
    ['', null],
    [',', null],
    ['abc', null],
    ['1.2.3', null],
  ])('%p → %p', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });
});

describe('sanitizeDecimalInput', () => {
  it('accepts the Italian keypad comma (the old regex rejected it)', () => {
    expect(sanitizeDecimalInput('72,', 1)).toBe('72,');
    expect(sanitizeDecimalInput('72,5', 1)).toBe('72,5');
  });
  it('rejects extra decimals and letters', () => {
    expect(sanitizeDecimalInput('72,55', 1)).toBeNull();
    expect(sanitizeDecimalInput('7a', 1)).toBeNull();
  });
  it('integers only', () => {
    expect(sanitizeIntegerInput('12')).toBe('12');
    expect(sanitizeIntegerInput('1.2')).toBeNull();
  });
});

describe('formatNumber', () => {
  it('uses the locale decimal separator', () => {
    expect(formatNumber(72.5, 'it')).toBe('72,5');
    expect(formatNumber(72.5, 'en')).toBe('72.5');
  });
});

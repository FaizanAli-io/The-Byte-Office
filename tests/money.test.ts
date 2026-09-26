import { describe, expect, it } from 'vitest';
import { convertMinor, formatMinor, parseMinor, serializeMinor, sumMinor, toMajor, toMinor } from '@/lib/money';

describe('parseMinor', () => {
  it.each([
    ['0.00', 0],
    ['1.00', 100],
    ['429079.00', 42_907_900],
    ['429079.99', 42_907_999],
    ['0.01', 1],
    ['0.1', 10],
    ['12', 1200],
    ['-5.25', -525],
    ['', 0],
  ])('parses %s as %i minor units', (input, expected) => {
    expect(parseMinor(input)).toBe(expected);
  });

  it('never routes through a float', () => {
    // Number('429079.99') * 100 is 42907998.999999996; the digits are exact.
    expect(parseMinor('429079.99')).toBe(42_907_999);
    expect(parseMinor('0.29')).toBe(29);
    expect(parseMinor('1.005')).toBe(101); // rounds the third decimal
  });

  it('treats null and undefined as zero', () => {
    expect(parseMinor(null)).toBe(0);
    expect(parseMinor(undefined)).toBe(0);
  });
});

describe('serializeMinor', () => {
  it.each([
    [0, '0.00'],
    [1, '0.01'],
    [100, '1.00'],
    [42_907_999, '429079.99'],
    [-525, '-5.25'],
  ])('writes %i as %s', (input, expected) => {
    expect(serializeMinor(input)).toBe(expected);
  });

  it('round-trips through parseMinor', () => {
    for (const value of [0, 1, 99, 100, 12_345, 42_907_999, -525]) {
      expect(parseMinor(serializeMinor(value))).toBe(value);
    }
  });
});

describe('toMinor and toMajor', () => {
  it.each([
    [0, 0],
    [1, 100],
    [19.99, 1999],
    [0.1, 10],
    [0.29, 29],
    [1234.56, 123_456],
  ])('converts %d rupees to %i minor units', (major, minor) => {
    expect(toMinor(major)).toBe(minor);
  });

  it('survives the classic binary representation traps', () => {
    // 19.99 * 100 is 1998.9999999999998 before rounding.
    expect(toMinor(19.99)).toBe(1999);
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });

  it('treats a non-finite amount as zero rather than NaN', () => {
    expect(toMinor(Number.NaN)).toBe(0);
    expect(toMinor(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('returns a decimal for display', () => {
    expect(toMajor(42_907_999)).toBe(429_079.99);
  });
});

describe('sumMinor', () => {
  it('is exact where floats are not', () => {
    // 0.1 + 0.2 + 0.3 !== 0.6 in floating point; in minor units it is.
    expect(sumMinor([10, 20, 30])).toBe(60);
  });

  it('stays exact over many additions', () => {
    const cents = Array.from({ length: 1000 }, () => 1);
    expect(sumMinor(cents)).toBe(1000);

    // The same sum as floats drifts away from 10.
    const asFloats = cents.reduce((total) => total + 0.01, 0);
    expect(asFloats).not.toBe(10);
  });

  it('is zero for no values', () => {
    expect(sumMinor([])).toBe(0);
  });
});

describe('convertMinor', () => {
  it('applies a whole rate exactly', () => {
    expect(convertMinor(10_000, 280)).toBe(2_800_000);
  });

  it('rounds a fractional result to the nearest minor unit', () => {
    expect(convertMinor(1, 280.5)).toBe(281);
    expect(convertMinor(3, 0.5)).toBe(2); // 1.5 rounds to 2
  });

  it('leaves the amount alone for an unusable rate', () => {
    expect(convertMinor(500, Number.NaN)).toBe(500);
  });

  it('always yields an integer', () => {
    for (const rate of [1.0001, 283.456789, 0.0036]) {
      expect(Number.isInteger(convertMinor(123_456, rate))).toBe(true);
    }
  });
});

describe('formatMinor', () => {
  // Intl separates the currency from the number with a non-breaking space.
  const normalise = (value: string) => value.replace(/\u00a0/g, ' ');

  it('shows PKR without decimals', () => {
    expect(normalise(formatMinor(42_907_999, 'PKR'))).toBe('PKR 429,080');
  });

  it('shows USD cents', () => {
    expect(normalise(formatMinor(12_345, 'USD'))).toBe('$123.45');
  });
});

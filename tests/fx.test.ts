import { describe, expect, it } from 'vitest';
import { formatQuote, quotePair, round2, splitTransfer } from '@/lib/fx';

const PKR = { currency: 'PKR', rate: 1 };
const USD = { currency: 'USD', rate: 280.92 };
const GBP = { currency: 'GBP', rate: 356.4 };

describe('round2', () => {
  it('rounds to 2 dp and never returns -0', () => {
    expect(round2(1.005 + 0.0001)).toBe(1.01);
    expect(Object.is(round2(-3.552713678800501e-15), 0)).toBe(true);
    expect(round2(-0.004)).toBe(0);
  });
});

describe('quotePair', () => {
  it('quotes PKR last and follows the market order between foreign currencies', () => {
    expect(quotePair('PKR', 'USD')).toEqual({ base: 'USD', quote: 'PKR', digits: 2 });
    expect(quotePair('USD', 'GBP')).toEqual({ base: 'GBP', quote: 'USD', digits: 4 });
    expect(quotePair('USD', 'EUR')).toMatchObject({ base: 'EUR', quote: 'USD' });
    expect(quotePair('SAR', 'AED')).toMatchObject({ base: 'AED', quote: 'SAR' });
    expect(quotePair('AED', 'USD')).toMatchObject({ base: 'USD', quote: 'AED' });
    expect(formatQuote(quotePair('USD', 'PKR'), 279)).toBe('USD/PKR 279.00');
  });
});

describe('splitTransfer', () => {
  it('A: a same-currency transfer that arrives in full has no cost entry', () =>
    expect(splitTransfer({ sent: 50_000, received: 50_000, source: PKR, destination: PKR })).toEqual({
      amount: 50_000,
    }));

  it('A: a same-currency shortfall is a transfer fee, with no note', () =>
    expect(splitTransfer({ sent: 50_000, received: 49_900, source: PKR, destination: PKR })).toEqual({
      amount: 49_900,
      difference: { type: 'expense', amount: 100, category: 'fees' },
    }));

  it('A: a same-currency transfer cannot receive more than it sent', () =>
    expect(splitTransfer({ sent: 100, received: 101, source: PKR, destination: PKR })).toEqual({
      error: "Received can't exceed sent for a same-currency transfer",
    }));

  it('B: foreign to PKR at a worse rate is an exchange cost', () =>
    expect(splitTransfer({ sent: 1000, received: 279_000, source: USD, destination: PKR })).toEqual({
      amount: 993.17,
      difference: {
        type: 'expense',
        amount: 6.83,
        category: 'cost',
        note: 'Received at USD/PKR 279.00; market 280.92',
      },
    }));

  it('C: foreign to PKR at a better rate is an exchange gain', () =>
    expect(splitTransfer({ sent: 1000, received: 282_000, source: USD, destination: PKR })).toEqual({
      amount: 1003.84,
      difference: {
        type: 'income',
        amount: 3.84,
        category: 'gain',
        note: 'Received at USD/PKR 282.00; market 280.92',
      },
    }));

  it('D: PKR to foreign quotes the foreign currency first', () =>
    expect(splitTransfer({ sent: 285_000, received: 1000, source: PKR, destination: USD })).toEqual({
      amount: 280_920,
      difference: {
        type: 'expense',
        amount: 4080,
        category: 'cost',
        note: 'Received at USD/PKR 285.00; market 280.92',
      },
    }));

  it('E: foreign to foreign quotes GBP/USD to 4 dp', () =>
    expect(splitTransfer({ sent: 500, received: 390, source: USD, destination: GBP })).toEqual({
      amount: 494.79,
      difference: {
        type: 'expense',
        amount: 5.21,
        category: 'cost',
        note: 'Received at GBP/USD 1.2821; market 1.2687',
      },
    }));

  it('always moves the source by exactly the amount sent', () => {
    for (const sent of [0.01, 1, 33.33, 999.99, 1234.56]) {
      for (const received of [1, 7.77, 280_000.01]) {
        const split = splitTransfer({ sent, received, source: USD, destination: PKR });
        if ('error' in split) continue;
        const cost = split.difference
          ? split.difference.type === 'expense'
            ? split.difference.amount
            : -split.difference.amount
          : 0;
        expect(Math.round((split.amount + cost) * 100) / 100).toBe(sent);
      }
    }
  });

  it('refuses a received amount too small to record', () =>
    expect(splitTransfer({ sent: 1, received: 0.001, source: USD, destination: PKR })).toHaveProperty('error'));
});

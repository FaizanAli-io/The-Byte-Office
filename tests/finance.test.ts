import { describe, expect, it } from 'vitest';
import {
  bankFundAllocations,
  individualFundAllocations,
  portfolioTotals,
  snapshotDiff,
  snapshotSeries,
  valuePkr,
} from '@/lib/finance';
import type { Holding } from '@/types/finance';

const bank = (id: string, name: string, amount: number): Holding => ({
  id,
  kind: 'local_bank',
  name,
  group: null,
  amount,
  exchangeRate: 1,
});
const fund = (id: string, group: string, name: string, amount: number): Holding => ({
  id,
  kind: 'mutual_fund',
  name,
  group,
  amount,
  exchangeRate: 1,
});
const wise: Holding = { id: 'r1', kind: 'remote_bank', name: 'Wise', group: null, amount: 100, exchangeRate: 280 };

const holdings: Holding[] = [
  bank('l1', 'HBL', 1000),
  bank('l2', 'Meezan', 500),
  wise,
  fund('f1', 'Meezan', 'Cash', 2000),
  fund('f2', 'Meezan', 'Growth', 3000),
  fund('f3', 'HBL', 'Income', 1500),
];

describe('portfolioTotals', () => {
  it('totals each class and the whole portfolio, remote banks at their rate', () => {
    expect(portfolioTotals(holdings)).toEqual({
      local: 1500,
      remote: 28_000,
      mutual: 6500,
      grandTotal: 36_000,
      held: 0,
      net: 36_000,
    });
    expect(valuePkr(wise)).toBe(28_000);
  });

  it('nets out money being held for someone else', () => {
    const totals = portfolioTotals(holdings, 6000);
    expect(totals.grandTotal).toBe(36_000);
    expect(totals.net).toBe(30_000);
  });

  it('is zero for an empty portfolio', () => {
    expect(portfolioTotals([]).grandTotal).toBe(0);
  });
});

describe('allocations', () => {
  it('groups funds by bank, in the order each bank first appears', () => {
    expect(bankFundAllocations(holdings)).toEqual([
      { name: 'Meezan', value: 5000 },
      { name: 'HBL', value: 1500 },
    ]);
  });

  it('lists each fund with its bank', () => {
    expect(individualFundAllocations(holdings).map((item) => item.name)).toEqual([
      'Meezan: Cash',
      'Meezan: Growth',
      'HBL: Income',
    ]);
  });
});

describe('snapshotDiff', () => {
  const totalDelta = (diff: ReturnType<typeof snapshotDiff>) => diff.classes.find((row) => row.name === 'Total')!.delta;

  it('reports nothing between identical snapshots', () => {
    const diff = snapshotDiff(holdings, structuredClone(holdings));
    expect(diff.lines).toEqual([]);
    expect(diff.classes.every((row) => row.delta === 0)).toBe(true);
  });

  it('lists moved, added and removed holdings, largest move first', () => {
    const newer = [
      bank('l1', 'HBL', 1200),
      wise,
      fund('f1', 'Meezan', 'Cash', 2000),
      fund('f2', 'Meezan', 'Growth', 3500),
      fund('f4', 'Meezan', 'Gold', 900),
    ];
    const diff = snapshotDiff(holdings, newer);
    expect(diff.lines).toEqual([
      { kind: 'Mutual fund', name: 'HBL: Income', before: 1500, after: null, delta: -1500 },
      { kind: 'Mutual fund', name: 'Meezan: Gold', before: null, after: 900, delta: 900 },
      { kind: 'Local bank', name: 'Meezan', before: 500, after: null, delta: -500 },
      { kind: 'Mutual fund', name: 'Meezan: Growth', before: 3000, after: 3500, delta: 500 },
      { kind: 'Local bank', name: 'HBL', before: 1000, after: 1200, delta: 200 },
    ]);
    expect(totalDelta(diff)).toBe(sum(diff.lines.map((line) => line.delta)));
  });

  it('values remote banks in PKR, so a rate change alone shows up', () => {
    const newer = holdings.map((holding) => (holding.id === 'r1' ? { ...holding, exchangeRate: 285 } : holding));
    const diff = snapshotDiff(holdings, newer);
    expect(diff.lines).toEqual([{ kind: 'Remote bank', name: 'Wise', before: 28_000, after: 28_500, delta: 500 }]);
    expect(diff.classes.find((row) => row.name === 'Remote banks')!.delta).toBe(500);
  });

  it('keeps a local bank and a fund bank with the same name apart', () => {
    const newer = holdings.filter((holding) => holding.id !== 'l1');
    expect(snapshotDiff(holdings, newer).lines.map((line) => line.name)).toEqual(['HBL']);
  });
});

describe('snapshotSeries', () => {
  it('offers every grain, from the total down to one fund', () => {
    const series = [...snapshotSeries(holdings).values()];
    const value = (kind: string, name: string) => series.find((row) => row.kind === kind && row.name === name)?.value;
    expect(value('Totals', 'Total')).toBe(36_000);
    expect(value('Totals', 'Mutual funds')).toBe(6500);
    expect(value('Bank accounts', 'Wise')).toBe(28_000);
    expect(value('Fund institutions', 'Meezan')).toBe(5000);
    expect(value('Funds', 'Meezan: Growth')).toBe(3000);
    expect(new Set(series.map((row) => row.kind))).toEqual(
      new Set(['Totals', 'Bank accounts', 'Fund institutions', 'Funds'])
    );
  });
});

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

import { describe, expect, it } from 'vitest';
import {
  bankFundAllocations,
  holdingTotals,
  individualFundAllocations,
  portfolioTotals,
  snapshotDiff,
  snapshotSeries,
} from '@/lib/finance';
import { flattenMutualFunds, groupMutualFunds } from '@/lib/db/queries';
import type { FinanceDoc } from '@/types/finance';

const doc: FinanceDoc = {
  name: 'finance',
  localBanks: [
    { id: 'l1', name: 'HBL', amountPkr: 1000 },
    { id: 'l2', name: 'Meezan', amountPkr: 500 },
  ],
  remoteBanks: [{ id: 'r1', name: 'Wise', amountUsd: 100, exchangeRate: 280 }],
  mutualFunds: [
    {
      Meezan: [
        { id: 'f1', fund: 'Cash', value: 2000 },
        { id: 'f2', fund: 'Growth', value: 3000 },
      ],
    },
    { HBL: [{ id: 'f3', fund: 'Income', value: 1500 }] },
  ],
};

describe('portfolioTotals', () => {
  it('totals each class and the whole portfolio', () => {
    expect(portfolioTotals(doc)).toEqual({
      local: 1500,
      remote: 28_000,
      mutual: 6500,
      grandTotal: 36_000,
      held: 0,
      net: 36_000,
    });
  });

  it('nets out money being held for someone else', () => {
    const totals = portfolioTotals(doc, 6000);
    // Gross is unchanged: the cash really is in the accounts, and
    // reconciliation has to keep agreeing with the bank.
    expect(totals.grandTotal).toBe(36_000);
    expect(totals.net).toBe(30_000);
  });

  it('is zero for an empty portfolio', () => {
    expect(portfolioTotals({ ...doc, localBanks: [], remoteBanks: [], mutualFunds: [] }).grandTotal).toBe(0);
  });

  it('agrees with holdingTotals over the same holdings', () => {
    // The editor holds grouped funds and the assistant holds flat rows; both
    // must report the same number.
    const flat = flattenMutualFunds(doc.mutualFunds).map(({ value }) => ({ value }));
    expect(holdingTotals({ localBanks: doc.localBanks, remoteBanks: doc.remoteBanks, mutualFunds: flat })).toEqual(
      portfolioTotals(doc)
    );
  });
});

describe('allocations', () => {
  it('groups funds by bank', () => {
    expect(bankFundAllocations(doc)).toEqual([
      { name: 'Meezan', value: 5000 },
      { name: 'HBL', value: 1500 },
    ]);
  });

  it('lists each fund with its bank', () => {
    expect(individualFundAllocations(doc).map((item) => item.name)).toEqual([
      'Meezan: Cash',
      'Meezan: Growth',
      'HBL: Income',
    ]);
  });
});

describe('mutual fund grouping', () => {
  it('round-trips through the flat row shape', () => {
    expect(groupMutualFunds(flattenMutualFunds(doc.mutualFunds))).toEqual(doc.mutualFunds);
  });

  it('keeps row ids so the assistant can target a fund', () => {
    expect(flattenMutualFunds(doc.mutualFunds).map((row) => row.id)).toEqual(['f1', 'f2', 'f3']);
  });

  it('separates groups by the sort-order stride', () => {
    expect(flattenMutualFunds(doc.mutualFunds).map((row) => row.sortOrder)).toEqual([0, 1, 1000]);
  });

  it('leaves a newly added fund without an id so it is inserted', () => {
    const [row] = flattenMutualFunds([{ Meezan: [{ fund: 'New', value: 1 }] }]);
    expect(row.id).toBeUndefined();
  });
});

describe('snapshotDiff', () => {
  const totalDelta = (diff: ReturnType<typeof snapshotDiff>) => diff.classes.find((row) => row.name === 'Total')!.delta;

  it('reports nothing between identical snapshots', () => {
    const diff = snapshotDiff(doc, structuredClone(doc));
    expect(diff.lines).toEqual([]);
    expect(diff.classes.every((row) => row.delta === 0)).toBe(true);
  });

  it('lists moved, added and removed holdings, largest move first', () => {
    const newer: FinanceDoc = {
      ...doc,
      localBanks: [{ name: 'HBL', amountPkr: 1200 }],
      mutualFunds: [
        {
          Meezan: [
            { fund: 'Cash', value: 2000 },
            { fund: 'Growth', value: 3500 },
            { fund: 'Gold', value: 900 },
          ],
        },
      ],
    };
    const diff = snapshotDiff(doc, newer);
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
    const newer = { ...doc, remoteBanks: [{ name: 'Wise', amountUsd: 100, exchangeRate: 285 }] };
    const diff = snapshotDiff(doc, newer);
    expect(diff.lines).toEqual([{ kind: 'Remote bank', name: 'Wise', before: 28_000, after: 28_500, delta: 500 }]);
    expect(diff.classes.find((row) => row.name === 'Remote banks')!.delta).toBe(500);
  });

  it('keeps a local bank and a fund bank with the same name apart', () => {
    const newer = { ...doc, localBanks: [...doc.localBanks.slice(1)] };
    expect(snapshotDiff(doc, newer).lines.map((line) => line.name)).toEqual(['HBL']);
  });
});

describe('snapshotSeries', () => {
  it('offers every grain, from the total down to one fund', () => {
    const series = [...snapshotSeries(doc).values()];
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

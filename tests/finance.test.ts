import { describe, expect, it } from 'vitest';
import { bankFundAllocations, holdingTotals, individualFundAllocations, portfolioTotals } from '@/lib/finance';
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

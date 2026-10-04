import { describe, expect, it } from 'vitest';
import {
  accountMovement,
  byAccountKind,
  accountStats,
  eligibleAccounts,
  expectedBalance,
  formatVariancePct,
  heldFunds,
  isMonth,
  ledgerSummary,
  monthBounds,
  reconcileDate,
  UNATTRIBUTED_HOLD,
  variancePct,
} from '@/lib/ledger';
import type { LedgerAccount, LedgerEntry } from '@/types/ledger';

const bank = (over: Partial<LedgerAccount> = {}): LedgerAccount => ({
  id: 'bank',
  name: 'HBL',
  type: 'bank',
  currency: 'PKR',
  openingBalance: 1000,
  exchangeRate: 1,
  ...over,
});

const fund = (over: Partial<LedgerAccount> = {}): LedgerAccount =>
  bank({ id: 'fund', name: 'Meezan Cash', type: 'fund', ...over });

const entry = (over: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id: 'e1',
  date: '2026-03-10',
  type: 'expense',
  accountId: 'bank',
  amount: 100,
  ...over,
});

describe('isMonth', () => {
  it.each([
    ['2026-01', true],
    ['2026-12', true],
    ['2026-00', false],
    ['2026-13', false],
    ['2026-1', false],
    ['not-a-month', false],
  ])('%s -> %s', (value, expected) => {
    expect(isMonth(value)).toBe(expected);
  });
});

describe('monthBounds', () => {
  it('covers a 31-day month', () => {
    expect(monthBounds('2026-01')).toEqual({ min: '2026-01-01', max: '2026-01-31' });
  });

  it('covers a 30-day month', () => {
    expect(monthBounds('2026-04')).toEqual({ min: '2026-04-01', max: '2026-04-30' });
  });

  it('handles February in a common year', () => {
    expect(monthBounds('2026-02').max).toBe('2026-02-28');
  });

  it('handles February in a leap year', () => {
    expect(monthBounds('2024-02').max).toBe('2024-02-29');
  });
});

describe('reconcileDate', () => {
  it('clamps to the end of a month that is not the current one', () => {
    expect(reconcileDate('2020-06')).toBe('2020-06-30');
  });

  it('returns a date inside the requested month', () => {
    const date = reconcileDate('2026-03');
    expect(date >= '2026-03-01' && date <= '2026-03-31').toBe(true);
  });
});

describe('accountMovement', () => {
  it('adds income and subtracts expenses', () => {
    expect(accountMovement('bank', entry({ type: 'income', amount: 250 }))).toBe(250);
    expect(accountMovement('bank', entry({ type: 'expense', amount: 250 }))).toBe(-250);
  });

  it('treats a fund contribution as an inflow to the fund', () => {
    expect(accountMovement('bank', entry({ type: 'fund_contribution', amount: 40 }))).toBe(40);
    expect(accountMovement('bank', entry({ type: 'fund_withdrawal', amount: 40 }))).toBe(-40);
  });

  it('moves the balance on a hold, because the cash really arrives and leaves', () => {
    expect(accountMovement('bank', entry({ type: 'hold_received', amount: 50_000 }))).toBe(50_000);
    expect(accountMovement('bank', entry({ type: 'hold_returned', amount: 50_000 }))).toBe(-50_000);
  });

  it('ignores entries that do not touch the account', () => {
    expect(accountMovement('other', entry())).toBe(0);
  });

  it('moves value out of the source and into the destination on a transfer', () => {
    const transfer = entry({ type: 'transfer', accountId: 'a', destinationAccountId: 'b', amount: 300 });
    expect(accountMovement('a', transfer)).toBe(-300);
    expect(accountMovement('b', transfer)).toBe(300);
    expect(accountMovement('c', transfer)).toBe(0);
  });

  it('credits the destination amount on a cross-currency transfer', () => {
    const transfer = entry({
      type: 'transfer',
      accountId: 'usd',
      destinationAccountId: 'pkr',
      amount: 100,
      destinationAmount: 28_000,
    });
    expect(accountMovement('usd', transfer)).toBe(-100);
    expect(accountMovement('pkr', transfer)).toBe(28_000);
  });
});

describe('expectedBalance', () => {
  it('is the opening balance when there are no entries', () => {
    expect(expectedBalance(bank(), [])).toBe(1000);
  });

  it('applies every entry that touches the account', () => {
    const entries = [
      entry({ id: 'a', type: 'income', amount: 500 }),
      entry({ id: 'b', type: 'expense', amount: 200 }),
      entry({ id: 'c', accountId: 'elsewhere', type: 'expense', amount: 900 }),
    ];
    expect(expectedBalance(bank(), entries)).toBe(1300);
  });
});

describe('accountStats', () => {
  it('reports no difference until an actual closing balance is entered', () => {
    const stats = accountStats(bank(), []);
    expect(stats.actual).toBeUndefined();
    expect(stats.difference).toBeUndefined();
  });

  it('reports the difference between actual and expected', () => {
    const stats = accountStats(bank({ actualClosingBalance: 1200 }), [entry({ type: 'income', amount: 100 })]);
    expect(stats.expected).toBe(1100);
    expect(stats.difference).toBe(100);
  });

  it('tracks net invested and gain for a fund', () => {
    const account = fund({ openingBalance: 500, openingCostBasis: 500, actualClosingBalance: 800 });
    const entries = [entry({ id: 'c', accountId: 'fund', type: 'fund_contribution', amount: 200 })];
    const stats = accountStats(account, entries);
    expect(stats.netInvested).toBe(700);
    expect(stats.gainLoss).toBe(100);
  });

  it('reduces net invested when money leaves the fund', () => {
    const account = fund({ openingBalance: 1000, openingCostBasis: 1000, actualClosingBalance: 900 });
    const entries = [entry({ id: 'w', accountId: 'fund', type: 'fund_withdrawal', amount: 300 })];
    expect(accountStats(account, entries).netInvested).toBe(700);
  });

  it('does not report a gain for a bank account', () => {
    expect(accountStats(bank({ actualClosingBalance: 1000 }), []).gainLoss).toBeUndefined();
  });
});

describe('variancePct', () => {
  it('is undefined when there is nothing to compare', () => {
    expect(variancePct(undefined, 100)).toBeUndefined();
  });

  it('is a percentage of the expected balance', () => {
    expect(variancePct(50, 1000)).toBe(5);
    expect(variancePct(-50, 1000)).toBe(-5);
  });

  it('is zero rather than n/a when expected is zero and nothing moved', () => {
    expect(variancePct(0, 0)).toBe(0);
  });

  it('is n/a when expected is zero but something moved', () => {
    expect(variancePct(10, 0)).toBeNull();
  });

  it('formats each of those cases distinctly', () => {
    expect(formatVariancePct(undefined)).toBe('—');
    expect(formatVariancePct(null)).toBe('n/a');
    expect(formatVariancePct(5)).toBe('+5.00%');
    expect(formatVariancePct(-5)).toBe('-5.00%');
  });
});

describe('ledgerSummary', () => {
  const accounts = [bank({ id: 'pkr' }), bank({ id: 'usd', currency: 'USD', exchangeRate: 280 }), fund({ id: 'fund' })];

  it('nets income against expenses', () => {
    const summary = ledgerSummary({
      accounts,
      entries: [
        entry({ id: 'i', accountId: 'pkr', type: 'income', amount: 5000 }),
        entry({ id: 'e', accountId: 'pkr', type: 'expense', amount: 2000 }),
      ],
    });
    expect(summary).toMatchObject({ income: 5000, expenses: 2000, netCashFlow: 3000 });
  });

  it('converts foreign-currency entries at the account rate', () => {
    const summary = ledgerSummary({
      accounts,
      entries: [entry({ id: 'i', accountId: 'usd', type: 'income', amount: 100 })],
    });
    expect(summary.income).toBe(28_000);
  });

  it('prefers a rate stated on the entry over the account default', () => {
    const summary = ledgerSummary({
      accounts,
      entries: [entry({ id: 'i', accountId: 'usd', type: 'income', amount: 100, exchangeRate: 300 })],
    });
    expect(summary.income).toBe(30_000);
  });

  it('keeps transfers out of income and expenses', () => {
    const summary = ledgerSummary({
      accounts,
      entries: [entry({ id: 't', type: 'transfer', accountId: 'pkr', destinationAccountId: 'fund', amount: 1000 })],
    });
    expect(summary.income).toBe(0);
    expect(summary.expenses).toBe(0);
  });

  it('counts a transfer into a fund as fund inflow', () => {
    const summary = ledgerSummary({
      accounts,
      entries: [entry({ id: 't', type: 'transfer', accountId: 'pkr', destinationAccountId: 'fund', amount: 1000 })],
    });
    expect(summary.fundFlow).toBe(1000);
  });

  it('counts a transfer out of a fund as fund outflow', () => {
    const summary = ledgerSummary({
      accounts,
      entries: [entry({ id: 't', type: 'transfer', accountId: 'fund', destinationAccountId: 'pkr', amount: 400 })],
    });
    expect(summary.fundFlow).toBe(-400);
  });

  it('nets contributions against withdrawals', () => {
    const summary = ledgerSummary({
      accounts,
      entries: [
        entry({ id: 'c', accountId: 'fund', type: 'fund_contribution', amount: 900 }),
        entry({ id: 'w', accountId: 'fund', type: 'fund_withdrawal', amount: 400 }),
      ],
    });
    expect(summary.fundFlow).toBe(500);
  });
});

describe('decimal amounts', () => {
  it('treats an accumulated rounding error as the zero it was meant to be', () => {
    const entries = Array.from({ length: 1000 }, (_, index) =>
      entry({ id: `e${index}`, type: 'expense', amount: 0.01 })
    );
    const stats = accountStats(bank({ openingBalance: 10, actualClosingBalance: 0 }), entries);

    expect(stats.expected).toBeCloseTo(0, 6);
    expect(stats.difference).toBeCloseTo(0, 6);
    expect(formatVariancePct(variancePct(stats.difference, stats.expected))).toBe('0.00%');
  });

  it('still reports a real variance against a zero expected balance', () => {
    expect(variancePct(10, 0)).toBeNull();
  });

  it('keeps a balanced month reporting no variance', () => {
    const stats = accountStats(bank({ openingBalance: 0, actualClosingBalance: 0 }), [
      entry({ id: 'a', type: 'income', amount: 19.99 }),
      entry({ id: 'b', type: 'income', amount: 29.99 }),
      entry({ id: 'c', type: 'expense', amount: 49.98 }),
    ]);
    expect(stats.expected).toBeCloseTo(0, 6);
    expect(formatVariancePct(variancePct(stats.difference, stats.expected))).toBe('0.00%');
  });

  it('converts a foreign-currency entry at the full rate, without rounding', () => {
    const summary = ledgerSummary({
      accounts: [bank({ id: 'usd', currency: 'USD', exchangeRate: 283.456789 }), bank({ id: 'pkr' })],
      entries: [entry({ id: 'i', accountId: 'usd', type: 'income', amount: 123.45 })],
    });
    expect(summary.income).toBeCloseTo(123.45 * 283.456789, 6);
  });
});

describe('eligibleAccounts', () => {
  const accounts = [bank(), fund()];

  it('offers only funds to a fund movement', () => {
    expect(eligibleAccounts(accounts, 'fund_contribution').map((account) => account.id)).toEqual(['fund']);
  });

  it('offers only banks to a hold', () => {
    expect(eligibleAccounts(accounts, 'hold_received').map((account) => account.id)).toEqual(['bank']);
    expect(eligibleAccounts(accounts, 'hold_returned').map((account) => account.id)).toEqual(['bank']);
  });

  it('offers everything to an ordinary entry', () => {
    expect(eligibleAccounts(accounts, 'expense')).toHaveLength(2);
  });
});

describe('heldFunds', () => {
  const movement = (type: 'hold_received' | 'hold_returned', amountPkr: number, counterparty?: string) => ({
    type,
    counterparty,
    amountPkr,
  });

  it('is what came in minus what went back', () => {
    const held = heldFunds([movement('hold_received', 50_000, 'Ali'), movement('hold_returned', 20_000, 'Ali')]);
    expect(held.total).toBe(30_000);
    expect(held.byCounterparty).toEqual([{ counterparty: 'Ali', received: 50_000, returned: 20_000, amount: 30_000 }]);
  });

  it('keeps counterparties apart and sorts by what is owed', () => {
    const held = heldFunds([movement('hold_received', 10_000, 'Ali'), movement('hold_received', 40_000, 'Sara')]);
    expect(held.byCounterparty.map((row) => row.counterparty)).toEqual(['Sara', 'Ali']);
  });

  it('drops a counterparty who has been paid back in full', () => {
    const held = heldFunds([movement('hold_received', 5000, 'Ali'), movement('hold_returned', 5000, 'Ali')]);
    expect(held.total).toBe(0);
    expect(held.byCounterparty).toEqual([]);
  });

  it('still shows a counterparty who was over-repaid, since that is a mistake', () => {
    const held = heldFunds([movement('hold_received', 1000, 'Ali'), movement('hold_returned', 1500, 'Ali')]);
    expect(held.byCounterparty).toEqual([{ counterparty: 'Ali', received: 1000, returned: 1500, amount: -500 }]);
  });

  it('groups holds with no name under one heading', () => {
    const held = heldFunds([movement('hold_received', 100), movement('hold_received', 200, '  ')]);
    expect(held.byCounterparty).toEqual([{ counterparty: UNATTRIBUTED_HOLD, received: 300, returned: 0, amount: 300 }]);
  });

  it('ignores every other entry type', () => {
    expect(heldFunds([{ type: 'income', amountPkr: 99_000 }]).total).toBe(0);
  });
});

describe('held funds in a monthly summary', () => {
  const accounts = [bank({ id: 'pkr' }), bank({ id: 'usd', currency: 'USD', exchangeRate: 280 })];

  it('stays out of income and expenses', () => {
    const summary = ledgerSummary({
      accounts,
      entries: [
        entry({ id: 'h', accountId: 'pkr', type: 'hold_received', amount: 50_000 }),
        entry({ id: 'e', accountId: 'pkr', type: 'expense', amount: 2000 }),
      ],
    });
    expect(summary).toMatchObject({ income: 0, expenses: 2000, heldMovement: 50_000 });
  });

  it('converts a hold taken in a foreign account at the entry rate', () => {
    const summary = ledgerSummary({
      accounts,
      entries: [entry({ id: 'h', accountId: 'usd', type: 'hold_received', amount: 100, exchangeRate: 300 })],
    });
    expect(summary.heldMovement).toBe(30_000);
  });

  it('is zero in a month with no holds', () => {
    const summary = ledgerSummary({ accounts, entries: [entry({ id: 'e', accountId: 'pkr', amount: 10 })] });
    expect(summary.heldMovement).toBe(0);
  });
});

describe('byAccountKind', () => {
  it('orders local banks, remote banks, then funds, keeping order within a kind', () => {
    const account = (name: string, type: 'bank' | 'fund', currency: 'PKR' | 'USD') => ({ name, type, currency });
    const sorted = [
      account('Meezan', 'bank', 'PKR'),
      account('NBP', 'fund', 'PKR'),
      account('MCB', 'fund', 'PKR'),
      account('Deel', 'bank', 'USD'),
      account('HBL', 'bank', 'PKR'),
    ].sort(byAccountKind);
    expect(sorted.map((item) => item.name)).toEqual(['Meezan', 'HBL', 'Deel', 'NBP', 'MCB']);
  });
});

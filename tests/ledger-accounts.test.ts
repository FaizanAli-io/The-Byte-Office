import { describe, expect, it } from 'vitest';
import { applyAccountAction, accountBalances, planAccountAction } from '@/lib/agent/modules/finance/ledger-accounts';
import { parseHolding } from '@/lib/agent/modules/finance/action-parsing';
import { filterLedgerEntries } from '@/lib/ledger-entries';
import type { LedgerCategory, MonthlyLedger } from '@/types/ledger';

const ledger: MonthlyLedger = {
  id: 'ledger-1',
  month: '2026-03',
  status: 'draft',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  accounts: [
    { id: 'a', name: 'HBL', type: 'bank', currency: 'PKR', openingBalance: 1000, exchangeRate: 1 },
    { id: 'b', name: 'Wise', type: 'bank', currency: 'USD', openingBalance: 10, exchangeRate: 280 },
  ],
  entries: [{ id: 'e1', date: '2026-03-05', type: 'expense', accountId: 'a', amount: 100 }],
};

const run = (type: Parameters<typeof planAccountAction>[0], args: Record<string, unknown>) =>
  applyAccountAction(planAccountAction(type, { month: ledger.month, ...args }, ledger).payload, ledger);

describe('ledger account actions', () => {
  it('adds a PKR bank by default, takes any currency without a rate, and keeps funds in PKR', () => {
    const added = run('ledger_account_add', { name: 'Meezan' }).at(-1);
    expect(added).toMatchObject({ name: 'Meezan', type: 'bank', currency: 'PKR', openingBalance: 0 });
    expect(run('ledger_account_add', { name: 'Wise GBP', currency: 'GBP' }).at(-1)).toMatchObject({ currency: 'GBP' });
    expect(() => run('ledger_account_add', { name: 'Fund', type: 'fund', currency: 'USD' })).toThrow(/PKR/);
  });

  it('updates by name, and null clears an optional balance', () => {
    const withClose = run('ledger_account_update', { accountName: 'HBL', actualClosingBalance: 950 });
    expect(withClose[0].actualClosingBalance).toBe(950);
    const cleared = applyAccountAction(
      {
        actionType: 'ledger_account_update',
        month: ledger.month,
        accountId: 'a',
        changes: { actualClosingBalance: null },
      },
      { ...ledger, accounts: withClose }
    );
    expect('actualClosingBalance' in cleared[0]).toBe(false);
  });

  it('ignores a typed rate and refuses an update with nothing in it', () => {
    expect(() => run('ledger_account_update', { accountId: 'b', exchangeRate: 2 })).toThrow(/Nothing to change/);
    expect(() => run('ledger_account_update', { accountId: 'a' })).toThrow(/Nothing to change/);
  });

  it('refuses to remove an account that entries use', () => {
    expect(() => run('ledger_account_remove', { accountId: 'a' })).toThrow(/Delete entries/);
    expect(run('ledger_account_remove', { accountName: 'Wise' }).map((account) => account.id)).toEqual(['a']);
  });

  it('reports expected closing and the reconciliation difference', () => {
    const [hbl] = accountBalances({
      ...ledger,
      accounts: run('ledger_account_update', { accountId: 'a', actualClosingBalance: 880 }),
    });
    expect(hbl).toMatchObject({
      expectedClosingBalance: 900,
      difference: -20,
      variancePct: (-20 / 900) * 100,
      reconciled: false,
    });
  });
});

describe('parseHolding', () => {
  it('needs a bank for a fund and a foreign currency for a remote bank, and fixes the rest', () => {
    expect(parseHolding({ kind: 'mutual_fund', name: 'Cash', group: 'Meezan', amount: 5 })).toEqual({
      kind: 'mutual_fund',
      name: 'Cash',
      group: 'Meezan',
      currency: 'PKR',
      amount: 5,
    });
    expect(() => parseHolding({ kind: 'mutual_fund', name: 'Cash', amount: 5 })).toThrow(/group/);
    expect(() => parseHolding({ kind: 'remote_bank', name: 'Wise', amount: 5 })).toThrow(/foreign currency/);
    expect(() => parseHolding({ kind: 'remote_bank', name: 'Wise', amount: 5, currency: 'PKR' })).toThrow(/foreign/);
    expect(() => parseHolding({ kind: 'local_bank', name: 'HBL', amount: 5, currency: 'USD' })).toThrow(/remote/);
    expect(parseHolding({ kind: 'local_bank', name: 'HBL', group: 'x', amount: 1 })).toMatchObject({
      group: null,
      currency: 'PKR',
    });
  });

  it('fills an update from the current holding and never changes its kind', () => {
    const current = { kind: 'remote_bank' as const, name: 'Wise', group: null, currency: 'USD', amount: 100 };
    expect(parseHolding({ amount: 120, kind: 'local_bank' }, current)).toEqual({ ...current, amount: 120 });
  });
});

describe('filterLedgerEntries', () => {
  const withEntries: MonthlyLedger = {
    ...ledger,
    entries: [
      { id: 'e1', date: '2026-03-05', type: 'expense', accountId: 'a', amount: 100, categoryId: 'food' },
      { id: 'e2', date: '2026-03-09', type: 'income', accountId: 'b', amount: 5 },
    ],
  };
  const categories = [{ id: 'food', name: 'Food', kind: 'expense' }] as LedgerCategory[];
  const ids = (params: Record<string, unknown>) =>
    filterLedgerEntries(withEntries, categories, params).map((entry) => entry.id);

  it('sorts newest first unless asked otherwise', () => {
    expect(ids({})).toEqual(['e2', 'e1']);
    expect(ids({ sortDir: 'asc' })).toEqual(['e1', 'e2']);
  });

  it('resolves account and category names, and rejects ones that match nothing', () => {
    expect(ids({ accountName: 'wise' })).toEqual(['e2']);
    expect(ids({ category: 'food' })).toEqual(['e1']);
    expect(() => ids({ accountName: 'nope' })).toThrow('accountName');
    expect(() => ids({ category: 'rent' })).toThrow('category');
  });

  it('rejects an unknown sort key from query params', () => {
    expect(() => ids({ sortBy: 'colour' })).toThrow();
  });
});

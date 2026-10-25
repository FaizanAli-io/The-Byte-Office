import { describe, expect, it } from 'vitest';
import {
  accountsForNewMonth,
  displayName,
  planLedgerHoldings,
  planPortfolioAccounts,
  splitName,
  valuesFrom,
  type HoldingIdentity,
} from '@/lib/accounts';
import type { LedgerAccount, LedgerEntry, MonthlyLedger } from '@/types/ledger';

const meezan: LedgerAccount = {
  id: 'a-meezan',
  holdingId: 'h-meezan',
  name: 'Meezan',
  type: 'bank',
  currency: 'PKR',
  openingBalance: 1000,
  exchangeRate: 1,
};
const deel: LedgerAccount = {
  id: 'a-deel',
  holdingId: 'h-deel',
  name: 'Deel',
  type: 'bank',
  currency: 'USD',
  openingBalance: 100,
  exchangeRate: 280,
};
const nbp: LedgerAccount = {
  id: 'a-nbp',
  holdingId: 'h-nbp',
  name: 'NBP Funds · Energy',
  type: 'fund',
  currency: 'PKR',
  openingBalance: 5000,
  openingCostBasis: 5000,
  exchangeRate: 1,
};
const expense = (amount: number, accountId = 'a-meezan'): LedgerEntry => ({
  id: `e-${amount}`,
  date: '2026-09-10',
  type: 'expense',
  accountId,
  amount,
});
const month = (
  accounts: LedgerAccount[],
  entries: LedgerEntry[] = []
): Pick<MonthlyLedger, 'accounts' | 'entries' | 'status'> => ({ accounts, entries, status: 'draft' });
const identity = (id: string, kind: HoldingIdentity['kind'], display: string, currency = 'PKR'): HoldingIdentity => ({
  id,
  kind,
  ...splitName(kind, display),
  currency,
});

describe('names', () => {
  it('splits a fund into bank and fund, and joins it back', () => {
    expect(splitName('mutual_fund', 'NBP Funds · Energy')).toEqual({ name: 'Energy', group: 'NBP Funds' });
    expect(displayName(splitName('mutual_fund', 'NBP Funds · Energy'))).toBe('NBP Funds · Energy');
    expect(splitName('local_bank', 'Meezan · Current')).toEqual({ name: 'Meezan · Current', group: null });
  });
});

describe('valuesFrom', () => {
  it('values each holding at its statement balance, else at what the entries add up to', () => {
    const values = valuesFrom(month([meezan, { ...nbp, actualClosingBalance: 5400 }, deel], [expense(150)]));
    expect(values.get('h-meezan')).toEqual({ amount: 850 });
    expect(values.get('h-nbp')).toEqual({ amount: 5400 });
    expect(values.get('h-deel')).toEqual({ amount: 100 });
  });
});

describe('planLedgerHoldings (ledger → holdings)', () => {
  it('gives an account added in the newest month a new, active holding', () => {
    const added: LedgerAccount = { ...nbp, id: 'a-new', holdingId: undefined, name: 'MCB Funds · Cash' };
    const { accounts, create } = planLedgerHoldings(month([meezan]), month([meezan, added]), true);
    expect(create).toEqual([
      {
        id: expect.any(String),
        kind: 'mutual_fund',
        name: 'Cash',
        group: 'MCB Funds',
        currency: 'PKR',
        archived: false,
      },
    ]);
    expect(accounts[1].holdingId).toBe(create[0].id);
  });

  it('gives a foreign bank account a remote holding in its currency', () => {
    const added: LedgerAccount = { ...deel, id: 'a-wise', holdingId: undefined, name: 'Wise', currency: 'GBP' };
    expect(planLedgerHoldings(month([meezan]), month([meezan, added]), true).create[0]).toMatchObject({
      kind: 'remote_bank',
      currency: 'GBP',
    });
  });

  it("keeps an existing account's currency, whatever the request says", () => {
    const { accounts, rename } = planLedgerHoldings(
      month([deel]),
      month([{ ...deel, name: 'Deel USD', currency: 'GBP' }]),
      true
    );
    expect(accounts[0].currency).toBe('USD');
    expect(rename[0]).toMatchObject({ kind: 'remote_bank', currency: 'USD' });
  });

  it('files an account added to an older month as an archived holding', () => {
    const added: LedgerAccount = { ...meezan, id: 'a-new', holdingId: undefined, name: 'HBL' };
    expect(planLedgerHoldings(month([meezan]), month([meezan, added]), false).create[0].archived).toBe(true);
  });

  it('renames the holding when its account is renamed', () => {
    const { rename } = planLedgerHoldings(month([meezan]), month([{ ...meezan, name: 'Meezan Current' }]), true);
    expect(rename).toEqual([
      { id: 'h-meezan', kind: 'local_bank', name: 'Meezan Current', group: null, currency: 'PKR' },
    ]);
  });

  it('archives the holding of an account removed from the newest month only', () => {
    expect(planLedgerHoldings(month([meezan, deel]), month([meezan]), true).archive).toEqual(['h-deel']);
    expect(planLedgerHoldings(month([meezan, deel]), month([meezan]), false).archive).toEqual([]);
  });
});

describe('planPortfolioAccounts (portfolio → newest month)', () => {
  const none = { create: [], update: [], archive: [] };

  it('records a changed amount as the closing balance, and leaves an unchanged one alone', () => {
    const ledger = month([meezan, deel], [expense(150)]);
    const accounts = planPortfolioAccounts(ledger, {
      ...none,
      update: [
        { id: 'h-meezan', value: { amount: 900 } },
        { id: 'h-deel', value: { amount: 100 } },
      ],
    });
    expect(accounts[0].actualClosingBalance).toBe(900);
    expect(accounts[1]).toEqual({ ...deel, actualClosingBalance: undefined });
  });

  it('drops the account of an archived holding unless entries use it', () => {
    expect(planPortfolioAccounts(month([meezan, deel]), { ...none, archive: ['h-deel'] })).toEqual([meezan]);
    expect(planPortfolioAccounts(month([meezan], [expense(10)]), { ...none, archive: ['h-meezan'] })).toEqual([meezan]);
  });

  it('opens an account for a new holding at its amount', () => {
    const holding = identity('h-hbl', 'local_bank', 'HBL');
    const [, added] = planPortfolioAccounts(month([meezan]), {
      ...none,
      create: [{ holding, value: { amount: 300 } }],
    });
    expect(added).toMatchObject({ holdingId: 'h-hbl', name: 'HBL', currency: 'PKR', openingBalance: 300 });
  });
});

describe('accountsForNewMonth', () => {
  it('opens each holding at last month’s value, with fresh ids and the fund cost basis carried', () => {
    const previous = {
      accounts: [meezan, nbp, deel],
      entries: [expense(150), { ...expense(500, 'a-nbp'), type: 'fund_contribution' as const }],
    };
    const holdings = [
      identity('h-meezan', 'local_bank', 'Meezan'),
      identity('h-deel', 'remote_bank', 'Deel', 'USD'),
      identity('h-nbp', 'mutual_fund', 'NBP Funds · Energy'),
      identity('h-new', 'local_bank', 'New'),
    ];
    const accounts = accountsForNewMonth(holdings, previous);
    expect(accounts.map((account) => [account.holdingId, account.openingBalance])).toEqual([
      ['h-meezan', 850],
      ['h-deel', 100],
      ['h-nbp', 5500],
      ['h-new', 0],
    ]);
    expect(accounts.some((account) => ['a-meezan', 'a-nbp', 'a-deel'].includes(account.id))).toBe(false);
    expect(accounts[2].openingCostBasis).toBe(5500);
    expect(accounts[1]).toMatchObject({ currency: 'USD', type: 'bank' });
  });
});

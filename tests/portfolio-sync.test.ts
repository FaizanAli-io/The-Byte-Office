import { describe, expect, it } from 'vitest';
import { accountsForNewMonth, planLedgerSave, planPortfolioSync, type Holding } from '@/lib/portfolio-sync';
import type { LedgerAccount, LedgerEntry, MonthlyLedger } from '@/types/ledger';

const holdings: Holding[] = [
  { id: 'h-meezan', kind: 'local_bank', name: 'Meezan', amount: 1000, exchangeRate: 1 },
  { id: 'h-deel', kind: 'remote_bank', name: 'Deel', amount: 100, exchangeRate: 280 },
  { id: 'h-nbp', kind: 'mutual_fund', name: 'NBP Funds · Energy', amount: 5000, exchangeRate: 1 },
];

const meezan: LedgerAccount = {
  id: 'a-meezan',
  holdingId: 'h-meezan',
  name: 'Meezan',
  type: 'bank',
  currency: 'PKR',
  openingBalance: 1000,
  exchangeRate: 1,
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
const deel: LedgerAccount = {
  id: 'a-deel',
  holdingId: 'h-deel',
  name: 'Deel',
  type: 'bank',
  currency: 'USD',
  openingBalance: 100,
  exchangeRate: 280,
};
const expense = (amount: number, accountId = 'a-meezan'): LedgerEntry => ({
  id: `e-${amount}`,
  date: '2026-09-10',
  type: 'expense',
  accountId,
  amount,
});

const ledger = (
  accounts: LedgerAccount[],
  entries: LedgerEntry[] = []
): Pick<MonthlyLedger, 'accounts' | 'entries' | 'status'> => ({ accounts, entries, status: 'draft' });

describe('planLedgerSave (ledger → portfolio)', () => {
  it('sets each holding to what its account is worth, preferring the statement balance', () => {
    const before = ledger([meezan, deel, nbp]);
    const after = ledger(
      [meezan, { ...deel, exchangeRate: 275 }, { ...nbp, actualClosingBalance: 5400 }],
      [expense(150)]
    );
    const { changes } = planLedgerSave(before, after, holdings);
    expect(changes.update).toEqual([
      { ...holdings[0], amount: 850 },
      { ...holdings[1], exchangeRate: 275 },
      { ...holdings[2], amount: 5400 },
    ]);
    expect(changes.create).toEqual([]);
    expect(changes.remove).toEqual([]);
  });

  it('gives an account added in the ledger a new holding and links it', () => {
    const added: LedgerAccount = { ...meezan, id: 'a-new', holdingId: undefined, name: 'HBL', openingBalance: 300 };
    const { accounts, changes } = planLedgerSave(
      ledger([meezan, deel, nbp]),
      ledger([meezan, deel, nbp, added]),
      holdings
    );
    expect(changes.create).toEqual([
      { id: expect.any(String), kind: 'local_bank', name: 'HBL', amount: 300, exchangeRate: 1 },
    ]);
    expect(accounts.find((account) => account.id === 'a-new')?.holdingId).toBe(changes.create[0].id);
  });

  it('removes the holding of an account removed in the ledger', () => {
    const { accounts, changes } = planLedgerSave(ledger([meezan, deel, nbp]), ledger([meezan, nbp]), holdings);
    expect(changes.remove).toEqual([holdings[1]]);
    expect(accounts.map((account) => account.id)).toEqual(['a-meezan', 'a-nbp']);
  });

  it('adds an account for a holding the month lacks, rather than deleting the holding', () => {
    // Deel today: a holding with no account. Absence alone must never read as removal.
    const { accounts, changes } = planLedgerSave(ledger([meezan, nbp]), ledger([meezan, nbp]), holdings);
    expect(changes.remove).toEqual([]);
    expect(accounts.at(-1)).toMatchObject({
      holdingId: 'h-deel',
      currency: 'USD',
      openingBalance: 100,
      exchangeRate: 280,
    });
  });

  it('gives an account added to a month being finalized its closing figure', () => {
    const after = { ...ledger([meezan, nbp]), status: 'finalized' as const };
    const { accounts } = planLedgerSave(ledger([meezan, nbp]), after, holdings);
    expect(accounts.at(-1)?.actualClosingBalance).toBe(100);
  });
});

describe('planPortfolioSync (portfolio → ledger)', () => {
  it('returns null when the save changed nothing', () => {
    expect(planPortfolioSync(ledger([meezan, deel, nbp]), holdings, holdings)).toBeNull();
  });

  it('leaves the month alone when a stale portfolio is saved unchanged', () => {
    // The ledger has moved on (an expense) but the portfolio still says 1000.
    expect(planPortfolioSync(ledger([meezan, deel, nbp], [expense(150)]), holdings, holdings)).toBeNull();
  });

  it('records a changed amount as the closing balance, and follows renames and rates', () => {
    const next = planPortfolioSync(ledger([meezan, deel, nbp], [expense(150)]), holdings, [
      { ...holdings[0], name: 'Meezan Current', amount: 900 },
      { ...holdings[1], exchangeRate: 285 },
      holdings[2],
    ]);
    expect(next?.[0]).toMatchObject({ name: 'Meezan Current', actualClosingBalance: 900 });
    expect(next?.[1]).toMatchObject({ exchangeRate: 285, actualClosingBalance: undefined });
    expect(next?.[2]).toEqual(nbp);
  });

  it('adds an account for a new holding', () => {
    const next = planPortfolioSync(ledger([meezan, nbp]), [holdings[0], holdings[2]], holdings);
    expect(next?.map((account) => account.holdingId)).toEqual(['h-meezan', 'h-nbp', 'h-deel']);
  });

  it('drops the account of a removed holding, unless entries still use it', () => {
    const remaining = [holdings[1], holdings[2]];
    const month = ledger([meezan, deel, nbp]);
    expect(planPortfolioSync(month, holdings, remaining)?.map((account) => account.id)).toEqual(['a-deel', 'a-nbp']);
    expect(planPortfolioSync(ledger([meezan, deel, nbp], [expense(10)]), holdings, remaining)).toBeNull();
  });

  it('leaves both sides agreeing: a ledger save straight after changes nothing', () => {
    const changed = [{ ...holdings[0], amount: 700 }, holdings[1], holdings[2]];
    const month = ledger([meezan, deel, nbp], [expense(150)]);
    const accounts = planPortfolioSync(month, holdings, changed)!;
    const { changes } = planLedgerSave({ accounts }, { ...month, accounts }, changed);
    expect(changes).toEqual({ create: [], update: [], remove: [] });
  });
});

describe('accountsForNewMonth', () => {
  it('opens one account per holding at its amount, with fresh ids and the fund cost basis carried', () => {
    const previous = {
      accounts: [meezan, nbp],
      entries: [{ ...expense(500, 'a-nbp'), type: 'fund_contribution' as const }],
    };
    const accounts = accountsForNewMonth(holdings, previous);
    expect(accounts.map((account) => [account.holdingId, account.openingBalance])).toEqual([
      ['h-meezan', 1000],
      ['h-deel', 100],
      ['h-nbp', 5000],
    ]);
    expect(accounts.some((account) => account.id === 'a-meezan' || account.id === 'a-nbp')).toBe(false);
    expect(accounts[2].openingCostBasis).toBe(5500);
    expect(accounts[1]).toMatchObject({ currency: 'USD', exchangeRate: 280 });
  });
});

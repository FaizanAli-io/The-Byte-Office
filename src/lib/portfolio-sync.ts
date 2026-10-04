import { randomUUID } from 'crypto';
import { accountStats, entryUsesAccount, expectedBalance } from '@/lib/ledger';
import type { LedgerAccount, MonthlyLedger } from '@/types/ledger';

/**
 * Keeps the portfolio and the newest ledger month describing the same money.
 *
 * Every holding has exactly one account in that month, linked by
 * `holdingId`, and the two are kept equal in both directions:
 *
 * - a ledger save sets each holding to what its account is worth — the
 *   statement balance once entered, otherwise what the entries add up to;
 * - a portfolio save that changes an amount records it as the account's
 *   actual closing balance, the same as typing in a statement figure;
 * - adding, renaming or removing on either side does the same on the other.
 *
 * Only the newest month is linked live. Older months are history, and a new
 * month opens at whatever the portfolio holds. Everything here is pure: the
 * callers in `db/sync.ts` load the rows and write the results.
 */

export type HoldingKind = 'local_bank' | 'remote_bank' | 'mutual_fund';

/** A holding as the ledger sees it: an amount in its own currency. Fund names read "Bank · Fund". */
export type Holding = { id: string; kind: HoldingKind; name: string; amount: number; exchangeRate: number };

export type HoldingChanges = { create: Holding[]; update: Holding[]; remove: Holding[] };

type LedgerState = Pick<MonthlyLedger, 'accounts' | 'entries' | 'status'>;

export const FUND_SEPARATOR = ' · ';

const ACCOUNT_SHAPE = {
  local_bank: { type: 'bank', currency: 'PKR' },
  remote_bank: { type: 'bank', currency: 'USD' },
  mutual_fund: { type: 'fund', currency: 'PKR' },
} as const;

export function kindOf(account: Pick<LedgerAccount, 'type' | 'currency'>): HoldingKind {
  if (account.type === 'fund') return 'mutual_fund';
  return account.currency === 'USD' ? 'remote_bank' : 'local_bank';
}

/** What the ledger says an account holds: the statement balance once entered, otherwise its entries' total. */
export function accountValue(account: LedgerAccount, entries: MonthlyLedger['entries']) {
  return account.actualClosingBalance ?? expectedBalance(account, entries);
}

const differs = (a: number, b: number) => Math.abs(a - b) >= 0.005;

/** A fresh account for a holding, opening at its current amount. */
export function accountFor(holding: Holding, finalized = false): LedgerAccount {
  const shape = ACCOUNT_SHAPE[holding.kind];
  return {
    id: randomUUID(),
    holdingId: holding.id,
    name: holding.name,
    ...shape,
    openingBalance: holding.amount,
    exchangeRate: shape.currency === 'USD' ? holding.exchangeRate : 1,
    ...(shape.type === 'fund' ? { openingCostBasis: holding.amount } : {}),
    // A month being finalized needs a closing figure on every account.
    ...(finalized ? { actualClosingBalance: holding.amount } : {}),
  };
}

/**
 * Ledger → portfolio, planned before the ledger is written. Returns the
 * accounts to save (unlinked ones get a new holding, holdings missing an
 * account get one) and the holding writes to make once that save succeeds.
 *
 * Removal is read from the before/after difference, never from a holding
 * merely lacking an account: that is also what a just-added holding looks
 * like, and guessing wrong would delete it.
 */
export function planLedgerSave(
  before: Pick<MonthlyLedger, 'accounts'> | null,
  after: LedgerState,
  holdings: Holding[]
) {
  const byId = new Map(holdings.map((holding) => [holding.id, holding]));
  const changes: HoldingChanges = { create: [], update: [], remove: [] };

  const kept = new Set(after.accounts.map((account) => account.id));
  const existed = new Set(before?.accounts.map((account) => account.id));
  for (const account of before?.accounts ?? []) {
    const holding = account.holdingId ? byId.get(account.holdingId) : undefined;
    if (holding && !kept.has(account.id)) changes.remove.push(holding);
  }

  const accounts = after.accounts.map((account) => {
    const amount = accountValue(account, after.entries);
    // An account that was already here unlinked lost its holding to a removal
    // and stays as history; only an account added in this save gets one.
    if (!account.holdingId && existed.has(account.id)) return account;
    if (!account.holdingId) {
      const holding = {
        id: randomUUID(),
        kind: kindOf(account),
        name: account.name,
        amount,
        exchangeRate: account.exchangeRate,
      };
      changes.create.push(holding);
      return { ...account, holdingId: holding.id };
    }
    const current = byId.get(account.holdingId);
    if (current) {
      const exchangeRate = current.kind === 'remote_bank' ? account.exchangeRate : current.exchangeRate;
      if (
        current.name !== account.name ||
        differs(current.amount, amount) ||
        differs(current.exchangeRate, exchangeRate)
      ) {
        changes.update.push({ ...current, name: account.name, amount, exchangeRate });
      }
    }
    return account;
  });

  const linked = new Set(accounts.map((account) => account.holdingId));
  const removed = new Set(changes.remove.map((holding) => holding.id));
  for (const holding of holdings) {
    if (!linked.has(holding.id) && !removed.has(holding.id)) {
      accounts.push(accountFor(holding, after.status === 'finalized'));
    }
  }

  return { accounts, changes };
}

/**
 * Portfolio → ledger, from the holdings before and after a portfolio save.
 * Returns the month's next accounts, or `null` when nothing needs to change.
 *
 * Only what the save changed moves across. Comparing every holding with its
 * account instead would also push values nobody touched — a portfolio that
 * is behind the ledger would overwrite the month's closing balances with its
 * stale figures. An account whose holding was removed goes with it, unless
 * entries still use it; then it stays, unlinked, for the month's history.
 */
export function planPortfolioSync(ledger: LedgerState, before: Holding[], after: Holding[]): LedgerAccount[] | null {
  const previous = new Map(before.map((holding) => [holding.id, holding]));
  const current = new Map(after.map((holding) => [holding.id, holding]));
  let changed = false;

  const accounts = ledger.accounts.flatMap((account) => {
    const was = account.holdingId ? previous.get(account.holdingId) : undefined;
    const holding = account.holdingId ? current.get(account.holdingId) : undefined;
    if (was && !holding) {
      if (ledger.entries.some((entry) => entryUsesAccount(entry, account.id))) {
        changed = true;
        return [{ ...account, holdingId: undefined }];
      }
      changed = true;
      return [];
    }
    if (
      !holding ||
      (was &&
        !differs(was.amount, holding.amount) &&
        was.name === holding.name &&
        !differs(was.exchangeRate, holding.exchangeRate))
    ) {
      return [account];
    }
    const amountChanged = !was || differs(was.amount, holding.amount);
    const next = {
      ...account,
      name: holding.name,
      exchangeRate: holding.kind === 'remote_bank' ? holding.exchangeRate : account.exchangeRate,
      actualClosingBalance:
        amountChanged && differs(accountValue(account, ledger.entries), holding.amount)
          ? holding.amount
          : account.actualClosingBalance,
    };
    if (
      next.name !== account.name ||
      next.exchangeRate !== account.exchangeRate ||
      next.actualClosingBalance !== account.actualClosingBalance
    ) {
      changed = true;
    }
    return [next];
  });

  const linked = new Set(accounts.map((account) => account.holdingId));
  for (const holding of after) {
    if (linked.has(holding.id)) continue;
    accounts.push(accountFor(holding));
    changed = true;
  }

  return changed ? accounts : null;
}

/**
 * A new month's accounts: one per holding, opening at the portfolio's amount.
 * From the previous month only a fund's cost basis carries over, since the
 * portfolio does not know it. Ids are always fresh: account ids are unique
 * across every month, so reusing one would collide with last month's row.
 */
export function accountsForNewMonth(holdings: Holding[], previous: Pick<MonthlyLedger, 'accounts' | 'entries'> | null) {
  return holdings.map((holding) => {
    const fresh = accountFor(holding);
    const carried = previous?.accounts.find((account) => account.holdingId === holding.id);
    if (!carried) return fresh;
    return fresh.type === 'fund'
      ? { ...fresh, openingCostBasis: accountStats(carried, previous!.entries).netInvested }
      : fresh;
  });
}

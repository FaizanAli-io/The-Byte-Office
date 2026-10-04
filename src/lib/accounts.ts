import { randomUUID } from 'crypto';
import { accountStats, entryUsesAccount, expectedBalance } from '@/lib/ledger';
import type { HoldingKind } from '@/types/finance';
import type { LedgerAccount, MonthlyLedger } from '@/types/ledger';

export type { HoldingKind };

export type HoldingIdentity = { id: string; kind: HoldingKind; name: string; group: string | null };

export type HoldingValue = { amount: number; exchangeRate: number };

export type PortfolioChange = {
  create: { holding: HoldingIdentity & { sortOrder?: number }; value: HoldingValue }[];
  update: { id: string; value: Partial<HoldingValue> }[];
  archive: string[];
};

type LedgerState = Pick<MonthlyLedger, 'accounts' | 'entries' | 'status'>;

export const FUND_SEPARATOR = ' · ';

const SHAPES = {
  local_bank: { type: 'bank', currency: 'PKR' },
  remote_bank: { type: 'bank', currency: 'USD' },
  mutual_fund: { type: 'fund', currency: 'PKR' },
} as const;

export const shapeOf = (kind: HoldingKind) => SHAPES[kind];

export function kindOf(account: Pick<LedgerAccount, 'type' | 'currency'>): HoldingKind {
  if (account.type === 'fund') return 'mutual_fund';
  return account.currency === 'USD' ? 'remote_bank' : 'local_bank';
}

export function displayName(holding: Pick<HoldingIdentity, 'name' | 'group'>) {
  return holding.group === null ? holding.name : `${holding.group}${FUND_SEPARATOR}${holding.name}`;
}

export function splitName(kind: HoldingKind, display: string): Pick<HoldingIdentity, 'name' | 'group'> {
  if (kind !== 'mutual_fund') return { name: display, group: null };
  const [group, ...rest] = display.split(FUND_SEPARATOR);
  return { name: rest.join(FUND_SEPARATOR) || group, group: group };
}

export function accountValue(account: LedgerAccount, entries: MonthlyLedger['entries']) {
  return account.actualClosingBalance ?? expectedBalance(account, entries);
}

export function valuesFrom(ledger: Pick<MonthlyLedger, 'accounts' | 'entries'> | null) {
  const values = new Map<string, HoldingValue>();
  for (const account of ledger?.accounts ?? []) {
    if (!account.holdingId) continue;
    values.set(account.holdingId, {
      amount: accountValue(account, ledger!.entries),
      exchangeRate: account.exchangeRate,
    });
  }
  return values;
}

const differs = (a: number, b: number) => Math.abs(a - b) >= 0.005;

export function accountFor(holding: HoldingIdentity, value: HoldingValue, finalized = false): LedgerAccount {
  const shape = shapeOf(holding.kind);
  return {
    id: randomUUID(),
    holdingId: holding.id,
    name: displayName(holding),
    ...shape,
    openingBalance: value.amount,
    exchangeRate: shape.currency === 'USD' ? value.exchangeRate : 1,
    ...(shape.type === 'fund' ? { openingCostBasis: value.amount } : {}),
    ...(finalized ? { actualClosingBalance: value.amount } : {}),
  };
}

export function planLedgerHoldings(
  before: Pick<MonthlyLedger, 'accounts'> | null,
  after: Pick<MonthlyLedger, 'accounts'>,
  newest: boolean
) {
  const previous = new Map(before?.accounts.map((account) => [account.id, account]));
  const kept = new Set(after.accounts.map((account) => account.id));
  const create: (HoldingIdentity & { archived: boolean })[] = [];
  const rename: HoldingIdentity[] = [];
  const archive = newest
    ? (before?.accounts ?? []).flatMap((account) =>
        account.holdingId && !kept.has(account.id) ? [account.holdingId] : []
      )
    : [];

  const accounts = after.accounts.map((account) => {
    const kind = kindOf(account);
    if (!account.holdingId) {
      // Only the newest month feeds the portfolio; an account added to an older one is history.
      const holding = { id: randomUUID(), kind, ...splitName(kind, account.name), archived: !newest };
      create.push(holding);
      return { ...account, holdingId: holding.id };
    }
    const was = previous.get(account.id);
    if (was && was.name !== account.name) {
      rename.push({ id: account.holdingId, kind, ...splitName(kind, account.name) });
    }
    return account;
  });

  return { accounts, create, rename, archive };
}

export function planPortfolioAccounts(ledger: LedgerState, change: PortfolioChange): LedgerAccount[] {
  const archived = new Set(change.archive);
  const updates = new Map(change.update.map((update) => [update.id, update.value]));

  const accounts = ledger.accounts.flatMap((account) => {
    if (account.holdingId && archived.has(account.holdingId)) {
      return ledger.entries.some((entry) => entryUsesAccount(entry, account.id)) ? [account] : [];
    }
    const value = account.holdingId ? updates.get(account.holdingId) : undefined;
    if (!value) return [account];
    return [
      {
        ...account,
        exchangeRate:
          account.currency === 'USD' && value.exchangeRate !== undefined ? value.exchangeRate : account.exchangeRate,
        actualClosingBalance:
          value.amount !== undefined && differs(accountValue(account, ledger.entries), value.amount)
            ? value.amount
            : account.actualClosingBalance,
      },
    ];
  });

  for (const { holding, value } of change.create)
    accounts.push(accountFor(holding, value, ledger.status === 'finalized'));
  return accounts;
}

// Always fresh ids: ledger_accounts.id is unique across every month.
export function accountsForNewMonth(
  holdings: HoldingIdentity[],
  previous: Pick<MonthlyLedger, 'accounts' | 'entries'> | null
) {
  const values = valuesFrom(previous);
  return holdings.map((holding) => {
    const fresh = accountFor(holding, values.get(holding.id) ?? { amount: 0, exchangeRate: 1 });
    const carried = previous?.accounts.find((account) => account.holdingId === holding.id);
    return carried && fresh.type === 'fund'
      ? { ...fresh, openingCostBasis: accountStats(carried, previous!.entries).netInvested }
      : fresh;
  });
}

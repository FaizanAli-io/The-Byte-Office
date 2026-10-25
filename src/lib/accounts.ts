import { randomUUID } from 'crypto';
import { accountStats, entryUsesAccount, expectedBalance } from '@/lib/ledger';
import { PKR } from '@/lib/fx';
import type { HoldingKind } from '@/types/finance';
import type { LedgerAccount, MonthlyLedger } from '@/types/ledger';

export type HoldingIdentity = { id: string; kind: HoldingKind; name: string; group: string | null; currency: string };

export type HoldingValue = { amount: number };

export type PortfolioChange = {
  create: { holding: HoldingIdentity & { sortOrder?: number }; value: HoldingValue }[];
  update: { id: string; value: Partial<HoldingValue> }[];
  archive: string[];
};

type LedgerState = Pick<MonthlyLedger, 'accounts' | 'entries' | 'status'>;

const FUND_SEPARATOR = ' · ';

export const typeOf = (kind: HoldingKind) => (kind === 'mutual_fund' ? 'fund' : 'bank');

function kindOf(account: Pick<LedgerAccount, 'type' | 'currency'>): HoldingKind {
  if (account.type === 'fund') return 'mutual_fund';
  return account.currency === PKR ? 'local_bank' : 'remote_bank';
}

export function displayName(holding: Pick<HoldingIdentity, 'name' | 'group'>) {
  return holding.group === null ? holding.name : `${holding.group}${FUND_SEPARATOR}${holding.name}`;
}

export function splitName(kind: HoldingKind, display: string): Pick<HoldingIdentity, 'name' | 'group'> {
  if (kind !== 'mutual_fund') return { name: display, group: null };
  const [group, ...rest] = display.split(FUND_SEPARATOR);
  return { name: rest.join(FUND_SEPARATOR) || group, group: group };
}

function accountValue(account: LedgerAccount, entries: MonthlyLedger['entries']) {
  return account.actualClosingBalance ?? expectedBalance(account, entries);
}

export function valuesFrom(ledger: Pick<MonthlyLedger, 'accounts' | 'entries'> | null) {
  const values = new Map<string, HoldingValue>();
  for (const account of ledger?.accounts ?? []) {
    if (!account.holdingId) continue;
    values.set(account.holdingId, { amount: accountValue(account, ledger!.entries) });
  }
  return values;
}

export const differs = (a: number, b: number) => Math.abs(a - b) >= 0.005;

function accountFor(holding: HoldingIdentity, value: HoldingValue, finalized = false): LedgerAccount {
  const type = typeOf(holding.kind);
  return {
    id: randomUUID(),
    holdingId: holding.id,
    name: displayName(holding),
    type,
    currency: holding.currency,
    openingBalance: value.amount,
    // Rates are resolved when the month is read; a draft stores none.
    exchangeRate: 1,
    ...(type === 'fund' ? { openingCostBasis: value.amount } : {}),
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
      const holding = {
        id: randomUUID(),
        kind,
        ...splitName(kind, account.name),
        currency: account.currency,
        archived: !newest,
      };
      create.push(holding);
      return { ...account, holdingId: holding.id };
    }
    // An existing account's currency comes from its holding, never from the request.
    const was = previous.get(account.id);
    const known = was ? { ...account, currency: was.currency } : account;
    if (was && was.name !== account.name) {
      rename.push({
        id: account.holdingId,
        kind: kindOf(known),
        ...splitName(kindOf(known), account.name),
        currency: known.currency,
      });
    }
    return known;
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
    const fresh = accountFor(holding, values.get(holding.id) ?? { amount: 0 });
    const carried = previous?.accounts.find((account) => account.holdingId === holding.id);
    return carried && fresh.type === 'fund'
      ? { ...fresh, openingCostBasis: accountStats(carried, previous!.entries).netInvested }
      : fresh;
  });
}

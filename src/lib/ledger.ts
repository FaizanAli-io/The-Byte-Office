import { PKR, round2 } from '@/lib/fx';
import type { LedgerAccount, LedgerCategory, LedgerEntry, LedgerEntryType, MonthlyLedger } from '@/types/ledger';

export const ENTRY_LABELS: Record<LedgerEntry['type'], string> = {
  income: 'Income',
  expense: 'Expense',
  transfer: 'Transfer',
  fund_contribution: 'Fund contribution',
  fund_withdrawal: 'Fund withdrawal',
  hold_received: 'Hold received',
  hold_returned: 'Hold returned',
};

export function isHoldType(type: LedgerEntryType) {
  return type === 'hold_received' || type === 'hold_returned';
}

export function eligibleAccounts<T extends Pick<LedgerAccount, 'type'>>(accounts: T[], type: LedgerEntryType) {
  if (type === 'fund_contribution' || type === 'fund_withdrawal') {
    return accounts.filter((account) => account.type === 'fund');
  }
  if (isHoldType(type)) return accounts.filter((account) => account.type === 'bank');
  return accounts;
}

export const RECONCILIATION_CATEGORY = 'Reconciliation';

export function categoryName(categoryList: LedgerCategory[], id?: string) {
  return categoryList.find((category) => category.id === id)?.name ?? '';
}

export function pickableCategories(categoryList: LedgerCategory[], type: LedgerEntryType, keepId?: string) {
  return categoryList.filter((category) => {
    if (category.id === keepId) return true;
    if (category.archivedAt) return false;
    if (type === 'income' || type === 'expense') return category.kind === type || category.kind === 'both';
    return true;
  });
}

export function resolveCategoryId(categoryList: LedgerCategory[], name: unknown) {
  if (typeof name !== 'string' || !name.trim()) return undefined;
  const requested = name.trim().toLowerCase();
  const pool = categoryList.filter((category) => !category.archivedAt);

  const exact = pool.find((category) => category.name.toLowerCase() === requested);
  if (exact) return exact.id;

  const partial = pool.filter((category) => category.name.toLowerCase().includes(requested));
  return partial.length === 1 ? partial[0].id : undefined;
}

export function resolveAccountId(accounts: LedgerAccount[], accountName: unknown) {
  if (typeof accountName !== 'string' || !accountName.trim()) return undefined;
  const requested = accountName.trim().toLowerCase();
  const matches = accounts.filter((account) => {
    const name = account.name.toLowerCase();
    if (name.includes(requested) || requested.includes(name)) return true;
    const initials = name
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join('');
    return initials.includes(requested);
  });
  return matches.length === 1 ? matches[0].id : undefined;
}

export function isMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function nextMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, '0')}`;
}

export function monthBounds(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    min: `${month}-01`,
    max: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'PKR' ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function accountMovement(accountId: string, entry: LedgerEntry) {
  if (entry.type === 'transfer') {
    if (entry.accountId === accountId) return -entry.amount;
    if (entry.destinationAccountId === accountId) {
      return entry.destinationAmount ?? entry.amount;
    }
    return 0;
  }

  if (entry.accountId !== accountId) return 0;
  if (entry.type === 'income' || entry.type === 'fund_contribution' || entry.type === 'hold_received') {
    return entry.amount;
  }
  return -entry.amount;
}

export function expectedBalance(account: LedgerAccount, entries: LedgerEntry[]) {
  return entries.reduce((balance, entry) => balance + accountMovement(account.id, entry), account.openingBalance);
}

export function reconcileDate(month: string) {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const bounds = monthBounds(month);
  return iso >= bounds.min && iso <= bounds.max ? iso : bounds.max;
}

export function variancePct(difference: number | undefined, expected: number) {
  if (difference === undefined) return undefined;
  if (Math.abs(expected) < 0.005) return Math.abs(difference) < 0.005 ? 0 : null;
  return (difference / expected) * 100;
}

export function formatVariancePct(pct: number | null | undefined) {
  if (pct === undefined) return '—';
  if (pct === null) return 'n/a';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function accountStats(account: LedgerAccount, entries: LedgerEntry[]) {
  const expected = expectedBalance(account, entries);
  const actual = account.actualClosingBalance;
  const netInvested =
    (account.openingCostBasis ?? account.openingBalance) +
    entries.reduce((total, entry) => {
      if (entry.accountId === account.id) {
        if (entry.type === 'fund_contribution') return total + entry.amount;
        if (entry.type === 'fund_withdrawal') return total - entry.amount;
      }
      if (entry.destinationAccountId === account.id && entry.type === 'transfer' && account.type === 'fund') {
        return total + (entry.destinationAmount ?? entry.amount);
      }
      if (entry.accountId === account.id && entry.type === 'transfer' && account.type === 'fund') {
        return total - entry.amount;
      }
      return total;
    }, 0);

  return {
    expected,
    actual,
    difference: actual === undefined ? undefined : actual - expected,
    netInvested,
    gainLoss: account.type === 'fund' && actual !== undefined ? actual - netInvested : undefined,
  };
}

export function ledgerSummary(ledger: Pick<MonthlyLedger, 'accounts' | 'entries'>) {
  const pkr = (entry: LedgerEntry) => toPkr(entry.amount, entry.accountId, ledger.accounts, entry.exchangeRate);
  const totalOf = (type: LedgerEntryType) =>
    ledger.entries.filter((entry) => entry.type === type).reduce((total, entry) => total + pkr(entry), 0);
  const income = totalOf('income');
  const expenses = totalOf('expense');
  const fundFlow = ledger.entries.reduce((total, entry) => {
    const amount = pkr(entry);
    if (entry.type === 'fund_contribution') return total + amount;
    if (entry.type === 'fund_withdrawal') return total - amount;
    if (entry.type === 'transfer') {
      const source = ledger.accounts.find((account) => account.id === entry.accountId);
      const destination = ledger.accounts.find((account) => account.id === entry.destinationAccountId);
      const destinationValue = toPkr(entry.destinationAmount ?? entry.amount, destination?.id ?? '', ledger.accounts);
      const inflow = destination?.type === 'fund' ? destinationValue : 0;
      const outflow = source?.type === 'fund' ? amount : 0;
      return total + inflow - outflow;
    }
    return total;
  }, 0);

  const heldMovement = heldFunds(
    ledger.entries.map((entry) => ({
      type: entry.type,
      counterparty: entry.counterparty,
      amountPkr: pkr(entry),
    }))
  ).total;

  // Rounded to the paisa: live rates such as 276.85 otherwise surface as 19491.898999999998.
  return {
    income: round2(income),
    expenses: round2(expenses),
    netCashFlow: round2(income - expenses),
    fundFlow: round2(fundFlow),
    heldMovement: round2(heldMovement),
  };
}

export function categoryTotals(ledger: Pick<MonthlyLedger, 'accounts' | 'entries'>) {
  const totals = new Map<string, { income: number; expense: number }>();
  for (const entry of ledger.entries) {
    if (entry.type !== 'income' && entry.type !== 'expense') continue;
    const key = entry.categoryId ?? '';
    const current = totals.get(key) ?? { income: 0, expense: 0 };
    current[entry.type] += toPkr(entry.amount, entry.accountId, ledger.accounts, entry.exchangeRate);
    totals.set(key, current);
  }
  return totals;
}

export function ledgerCategoryTotals(
  ledger: Pick<MonthlyLedger, 'accounts' | 'entries'>,
  categories: LedgerCategory[]
) {
  const rows = [...categoryTotals(ledger)].map(([id, totals]) => ({
    category: categoryName(categories, id || undefined) || 'Uncategorised',
    ...totals,
  }));
  const list = (type: 'income' | 'expense') =>
    rows
      .filter((row) => row[type])
      .map((row) => ({ category: row.category, amountPkr: round2(row[type]) }))
      .sort((a, b) => b.amountPkr - a.amountPkr);
  return { income: list('income'), expenses: list('expense') };
}

export const UNATTRIBUTED_HOLD = 'Unattributed';

type HoldMovement = {
  type: LedgerEntryType;
  counterparty?: string | null;
  amountPkr: number;
};

export function heldFunds(movements: HoldMovement[]) {
  const byCounterparty = new Map<string, { received: number; returned: number }>();
  let total = 0;

  for (const movement of movements) {
    if (!isHoldType(movement.type)) continue;
    const isReceipt = movement.type === 'hold_received';
    const who = movement.counterparty?.trim() || UNATTRIBUTED_HOLD;
    const running = byCounterparty.get(who) ?? { received: 0, returned: 0 };

    if (isReceipt) running.received += movement.amountPkr;
    else running.returned += movement.amountPkr;

    byCounterparty.set(who, running);
    total += isReceipt ? movement.amountPkr : -movement.amountPkr;
  }

  return {
    total,
    byCounterparty: [...byCounterparty]
      .map(([counterparty, running]) => ({ counterparty, ...running, amount: running.received - running.returned }))
      .filter((row) => Math.abs(row.amount) >= 0.005)
      .sort((a, b) => b.amount - a.amount),
  };
}

function toPkr(amount: number, accountId: string, accounts: LedgerAccount[], exchangeRate?: number) {
  const account = accounts.find((item) => item.id === accountId);
  return account && account.currency !== PKR ? amount * (exchangeRate ?? account.exchangeRate) : amount;
}

export function entryUsesAccount(entry: LedgerEntry, id: string) {
  return entry.accountId === id || entry.destinationAccountId === id;
}

export function entryDetail(entry: LedgerEntry, categoryList: LedgerCategory[]) {
  if (!isHoldType(entry.type)) return categoryName(categoryList, entry.categoryId);
  return entry.counterparty ? `for ${entry.counterparty}` : '';
}

export const ENTRY_SORT_KEYS = ['date', 'amount', 'type', 'account', 'category'] as const;
export const ENTRY_SORT_DIRS = ['asc', 'desc'] as const;

export type EntrySortKey = (typeof ENTRY_SORT_KEYS)[number];
export type EntrySortDir = (typeof ENTRY_SORT_DIRS)[number];

export type EntryFilters = {
  accountId: string;
  type: string;
  category: string;
  query: string;
  dateFrom: string;
  dateTo: string;
  sortBy: EntrySortKey;
  sortDir: EntrySortDir;
};

export const emptyFilters: EntryFilters = {
  accountId: 'all',
  type: 'all',
  category: 'all',
  query: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'date',
  sortDir: 'desc',
};

export function applyEntryFilters<T extends LedgerEntry>(
  entries: T[],
  filters: EntryFilters,
  accounts: LedgerAccount[],
  categories: LedgerCategory[]
) {
  const query = filters.query.trim().toLowerCase();
  const accountName = (id?: string) => accounts.find((account) => account.id === id)?.name ?? '';
  const filtered = entries.filter((entry) => {
    if (
      filters.accountId !== 'all' &&
      entry.accountId !== filters.accountId &&
      entry.destinationAccountId !== filters.accountId
    ) {
      return false;
    }
    if (filters.type !== 'all' && entry.type !== filters.type) return false;
    if (filters.category !== 'all' && (entry.categoryId ?? '') !== filters.category) return false;
    if (filters.dateFrom && entry.date < filters.dateFrom) return false;
    if (filters.dateTo && entry.date > filters.dateTo) return false;
    if (!query) return true;
    return [
      entryDetail(entry, categories),
      entry.note,
      accountName(entry.accountId),
      accountName(entry.destinationAccountId),
    ]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  const direction = filters.sortDir === 'asc' ? 1 : -1;
  return filtered.sort((a, b) => {
    const compare =
      filters.sortBy === 'amount'
        ? a.amount - b.amount
        : filters.sortBy === 'type'
          ? ENTRY_LABELS[a.type].localeCompare(ENTRY_LABELS[b.type])
          : filters.sortBy === 'account'
            ? accountName(a.accountId).localeCompare(accountName(b.accountId))
            : filters.sortBy === 'category'
              ? categoryName(categories, a.categoryId).localeCompare(categoryName(categories, b.categoryId))
              : a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
    return compare * direction;
  });
}

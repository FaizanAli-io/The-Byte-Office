'use client';

import { categoryName, ENTRY_LABELS } from '@/lib/ledger';
import type { LedgerAccount, LedgerCategory, LedgerEntry } from '@/types/ledger';
import { CollapseToggle, Field, financeStyles, openPicker } from '../components/FinanceUI';
import { entryDetail } from './EntryRows';

const ENTRY_SORT_KEYS = ['date', 'amount', 'type', 'account', 'category'] as const;
const ENTRY_SORT_DIRS = ['asc', 'desc'] as const;

export type EntrySortKey = (typeof ENTRY_SORT_KEYS)[number];
export type EntrySortDir = (typeof ENTRY_SORT_DIRS)[number];

const SORT_LABELS: Record<EntrySortKey, string> = {
  date: 'Date',
  amount: 'Amount',
  type: 'Type',
  account: 'Account',
  category: 'Category',
};

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

const FILTERS_KEY = 'ledger.filters.v2';

export function rememberedFilters(): EntryFilters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return emptyFilters;
    const stored = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...emptyFilters,
      accountId: storedText(stored.accountId, emptyFilters.accountId),
      type: storedText(stored.type, emptyFilters.type),
      category: storedText(stored.category, emptyFilters.category),
      query: storedText(stored.query, emptyFilters.query),
      sortBy: storedOneOf(stored.sortBy, ENTRY_SORT_KEYS, emptyFilters.sortBy),
      sortDir: storedOneOf(stored.sortDir, ENTRY_SORT_DIRS, emptyFilters.sortDir),
    };
  } catch {
    return emptyFilters;
  }
}

export function rememberFilters(filters: EntryFilters) {
  try {
    const { accountId, type, category, query, sortBy, sortDir } = filters;
    localStorage.setItem(FILTERS_KEY, JSON.stringify({ accountId, type, category, query, sortBy, sortDir }));
  } catch {}
}

function storedText(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

function storedOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function sortOrderLabel(sortBy: EntrySortKey, direction: EntrySortDir) {
  if (sortBy === 'amount') return direction === 'asc' ? 'Low to high' : 'High to low';
  if (sortBy === 'date') return direction === 'asc' ? 'Oldest first' : 'Newest first';
  return direction === 'asc' ? 'A to Z' : 'Z to A';
}

function isDefaultFilters(filters: EntryFilters) {
  return (Object.keys(emptyFilters) as (keyof EntryFilters)[]).every((key) => filters[key] === emptyFilters[key]);
}

export function applyEntryFilters(
  entries: LedgerEntry[],
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

export function EntryFiltersPanel({
  filters,
  setFilters,
  accounts,
  categories,
  bounds,
  open,
  onToggle,
  shownCount,
  totalCount,
}: {
  filters: EntryFilters;
  setFilters: (filters: EntryFilters) => void;
  accounts: LedgerAccount[];
  categories: { id: string; name: string }[];
  bounds: { min: string; max: string };
  open: boolean;
  onToggle: () => void;
  shownCount: number;
  totalCount: number;
}) {
  const filtersActive = !isDefaultFilters(filters);
  const set = (patch: Partial<EntryFilters>) => setFilters({ ...filters, ...patch });

  return (
    <div className={`${financeStyles.inset} mb-6`}>
      <CollapseToggle
        open={open}
        title="Filter & sort"
        subtitle={`Showing ${shownCount} of ${totalCount} transaction${totalCount === 1 ? '' : 's'}${filtersActive ? ' · filtered' : ''}`}
        onToggle={onToggle}
        action={
          filtersActive ? (
            <button type="button" className={financeStyles.secondary} onClick={() => setFilters(emptyFilters)}>
              Clear
            </button>
          ) : null
        }
      />
      {open ? (
        <div className="grid gap-3 border-t border-white/6 p-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Account">
            <select
              className={financeStyles.input}
              value={filters.accountId}
              onChange={(event) => set({ accountId: event.target.value })}
            >
              <option value="all">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select
              className={financeStyles.input}
              value={filters.type}
              onChange={(event) => set({ type: event.target.value })}
            >
              <option value="all">All types</option>
              {Object.entries(ENTRY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select
              className={financeStyles.input}
              value={filters.category}
              onChange={(event) => set({ category: event.target.value })}
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Search">
            <input
              className={financeStyles.input}
              value={filters.query}
              onChange={(event) => set({ query: event.target.value })}
              placeholder="Note, category, account…"
            />
          </Field>
          {(
            [
              ['From date', 'dateFrom'],
              ['To date', 'dateTo'],
            ] as const
          ).map(([label, key]) => (
            <Field key={key} label={label}>
              <input
                className={financeStyles.input}
                type="date"
                onClick={openPicker}
                min={bounds.min}
                max={bounds.max}
                value={filters[key]}
                onChange={(event) => set({ [key]: event.target.value })}
              />
            </Field>
          ))}
          <Field label="Sort by">
            <select
              className={financeStyles.input}
              value={filters.sortBy}
              onChange={(event) => set({ sortBy: event.target.value as EntrySortKey })}
            >
              {ENTRY_SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Order">
            <select
              className={financeStyles.input}
              value={filters.sortDir}
              onChange={(event) => set({ sortDir: event.target.value as EntrySortDir })}
            >
              <option value="asc">{sortOrderLabel(filters.sortBy, 'asc')}</option>
              <option value="desc">{sortOrderLabel(filters.sortBy, 'desc')}</option>
            </select>
          </Field>
        </div>
      ) : null}
    </div>
  );
}

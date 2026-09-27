'use client';

import { ENTRY_LABELS } from '@/lib/ledger';
import type { LedgerAccount } from '@/types/ledger';
import { financeStyles } from '../components/FinanceUI';
import { CollapseToggle, Field } from './LedgerAccounts';

/**
 * Filtering and sorting for the transactions table, kept out of the table
 * itself: eight controls that all patch one key of the same object, plus the
 * predicates that describe a default filter set.
 */

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
  sortDir: 'asc',
};

/**
 * Filters are remembered between visits, because there is almost always one
 * account or category being worked through and re-picking it every time is
 * friction. They live in this browser only: a convenience, not data, so a
 * fresh device simply starts on the defaults.
 *
 * The date window is deliberately *not* remembered. Every other filter means
 * the same thing in any month, but a date range belongs to the month it was
 * typed in — restoring March's "to 20 March" while viewing April would hide
 * every row with nothing on screen to explain why.
 *
 * Both accessors swallow their errors, and every stored value is checked on
 * the way back in. A private window, blocked site data or a hand-edited entry
 * should cost the remembered filters, never the ledger.
 */
const FILTERS_KEY = 'ledger.filters';

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
  } catch {
    // Nothing to do: the filters still work for this visit.
  }
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
  return (
    filters.accountId === emptyFilters.accountId &&
    filters.type === emptyFilters.type &&
    filters.category === emptyFilters.category &&
    filters.query === emptyFilters.query &&
    filters.dateFrom === emptyFilters.dateFrom &&
    filters.dateTo === emptyFilters.dateTo &&
    filters.sortBy === emptyFilters.sortBy &&
    filters.sortDir === emptyFilters.sortDir
  );
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
  /** Only the categories in use this month, as id and name. */
  categories: { id: string; name: string }[];
  bounds: { min: string; max: string };
  open: boolean;
  onToggle: () => void;
  shownCount: number;
  totalCount: number;
}) {
  const filtersActive = !isDefaultFilters(filters);

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
              onChange={(event) => setFilters({ ...filters, accountId: event.target.value })}
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
              onChange={(event) => setFilters({ ...filters, type: event.target.value })}
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
              onChange={(event) => setFilters({ ...filters, category: event.target.value })}
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
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
              placeholder="Note, category, account…"
            />
          </Field>
          <Field label="From date">
            <input
              className={financeStyles.input}
              type="date"
              min={bounds.min}
              max={bounds.max}
              value={filters.dateFrom}
              onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
            />
          </Field>
          <Field label="To date">
            <input
              className={financeStyles.input}
              type="date"
              min={bounds.min}
              max={bounds.max}
              value={filters.dateTo}
              onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
            />
          </Field>
          <Field label="Sort by">
            <select
              className={financeStyles.input}
              value={filters.sortBy}
              onChange={(event) => setFilters({ ...filters, sortBy: event.target.value as EntrySortKey })}
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
              onChange={(event) => setFilters({ ...filters, sortDir: event.target.value as EntrySortDir })}
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

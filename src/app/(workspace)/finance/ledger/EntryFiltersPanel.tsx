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

export type EntrySortKey = 'date' | 'amount' | 'type' | 'account' | 'category';
export type EntrySortDir = 'asc' | 'desc';

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

function sortOrderLabel(sortBy: EntrySortKey, direction: EntrySortDir) {
  if (sortBy === 'amount') return direction === 'asc' ? 'Low to high' : 'High to low';
  if (sortBy === 'date') return direction === 'asc' ? 'Oldest first' : 'Newest first';
  return direction === 'asc' ? 'A to Z' : 'Z to A';
}

export function isDefaultFilters(filters: EntryFilters) {
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
              <option value="date">Date</option>
              <option value="amount">Amount</option>
              <option value="type">Type</option>
              <option value="account">Account</option>
              <option value="category">Category</option>
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

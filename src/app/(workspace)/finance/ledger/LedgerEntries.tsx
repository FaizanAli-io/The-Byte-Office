'use client';

import { accountMovement, categoryName, ENTRY_LABELS, formatMoney, isHoldType, monthBounds } from '@/lib/ledger';
import type { LedgerAccount, LedgerCategory, LedgerEntry, LedgerEntryType } from '@/types/ledger';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FinanceCard, financeStyles } from '../components/FinanceUI';
import { CollapseToggle } from './LedgerAccounts';
import { draftIncomplete, emptyDraft, EntryFields } from './EntryFields';
import { HeldFundsModal } from './HeldFundsModal';
import {
  emptyFilters,
  EntryFiltersPanel,
  rememberFilters,
  rememberedFilters,
  type EntryFilters,
} from './EntryFiltersPanel';

/** Ten is enough to scan; the rest are for a month being worked through. */
const PAGE_SIZES = [10, 25, 50, 100];

export function LedgerEntries({
  month,
  accounts,
  categories,
  entries,
  readOnly,
  onAdd,
  onUpdate,
  onRemove,
}: {
  month: string;
  accounts: LedgerAccount[];
  categories: LedgerCategory[];
  entries: LedgerEntry[];
  readOnly: boolean;
  onAdd: (entry: LedgerEntry) => void;
  onUpdate: (entry: LedgerEntry) => void;
  onRemove: (id: string) => void;
}) {
  const bounds = monthBounds(month);
  const [filters, setFilters] = useState<EntryFilters>(emptyFilters);
  const [draft, setDraft] = useState(() => emptyDraft(bounds.min));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [holdingsOpen, setHoldingsOpen] = useState(false);

  // Refs rather than dependencies: restoring must happen when the month
  // changes, not every time an account is added or an entry is edited.
  const optionsRef = useRef<{ accounts: string[]; categories: string[] }>({ accounts: [], categories: [] });

  useEffect(() => {
    setDraft(emptyDraft(bounds.min));
    setEditingId(null);
    // Read here rather than in the initial state because this page is
    // prerendered, and touching localStorage during render would not match
    // what the server produced. Running on every month change is also what
    // keeps the choices sticky as you move between months.
    //
    // A remembered account or category that this month knows nothing about
    // falls back to "all": the select could not show it, and filtering by it
    // would produce an empty table for no visible reason.
    const stored = rememberedFilters();
    const known = optionsRef.current;
    setFilters({
      ...stored,
      accountId: known.accounts.includes(stored.accountId) ? stored.accountId : 'all',
      category: known.categories.includes(stored.category) ? stored.category : 'all',
    });
  }, [bounds.min]);

  /** Persisted at the point of change, so no effect can race the first read. */
  function applyFilters(next: EntryFilters) {
    rememberFilters(next);
    setFilters(next);
  }

  // Only the categories this month actually uses, so the filter does not list
  // dozens of options that would all return nothing.
  const usedCategories = useMemo(
    () =>
      categories
        .filter((category) => entries.some((entry) => entry.categoryId === category.id))
        .map((category) => ({ id: category.id, name: category.name })),
    [categories, entries]
  );

  const visibleEntries = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
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
      if (query) {
        const accountName = accounts.find((account) => account.id === entry.accountId)?.name ?? '';
        const destinationName = accounts.find((account) => account.id === entry.destinationAccountId)?.name ?? '';
        const haystack = [entryDetail(entry, categories), entry.note, accountName, destinationName]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const direction = filters.sortDir === 'asc' ? 1 : -1;
      const compare =
        filters.sortBy === 'amount'
          ? a.amount - b.amount
          : filters.sortBy === 'type'
            ? ENTRY_LABELS[a.type].localeCompare(ENTRY_LABELS[b.type])
            : filters.sortBy === 'account'
              ? (accounts.find((account) => account.id === a.accountId)?.name ?? '').localeCompare(
                  accounts.find((account) => account.id === b.accountId)?.name ?? ''
                )
              : filters.sortBy === 'category'
                ? categoryName(categories, a.categoryId).localeCompare(categoryName(categories, b.categoryId))
                : a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      return compare * direction;
    });
  }, [accounts, categories, entries, filters]);
  optionsRef.current = {
    accounts: ['all', ...accounts.map((account) => account.id)],
    categories: ['all', ...usedCategories.map((category) => category.id)],
  };

  const showRunning = filters.accountId !== 'all' && filters.sortBy === 'date' && filters.sortDir === 'asc';
  const sourceAccount = accounts.find((account) => account.id === draft.accountId);

  const pageCount = Math.max(1, Math.ceil(visibleEntries.length / pageSize));
  // Clamped rather than corrected in state: deleting the last row of the last
  // page should show the page before it, not an empty table.
  const currentPage = Math.min(page, pageCount);
  const firstOnPage = (currentPage - 1) * pageSize;
  const pageEntries = visibleEntries.slice(firstOnPage, firstOnPage + pageSize);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  function addEntry() {
    const amount = Number(draft.amount);
    if (!draft.accountId || !draft.date || !Number.isFinite(amount) || amount <= 0) {
      return;
    }
    const destinationAmount =
      draft.type === 'transfer' && draft.destinationAmount ? Number(draft.destinationAmount) : undefined;
    const previous = entries.find((item) => item.id === editingId);
    const entry: LedgerEntry = {
      id: editingId ?? crypto.randomUUID(),
      date: draft.date,
      type: draft.type,
      accountId: draft.accountId,
      destinationAccountId: draft.type === 'transfer' ? draft.destinationAccountId : undefined,
      amount,
      destinationAmount,
      exchangeRate:
        previous?.accountId === draft.accountId
          ? (previous.exchangeRate ?? sourceAccount?.exchangeRate ?? 1)
          : (sourceAccount?.exchangeRate ?? 1),
      categoryId: draft.categoryId || undefined,
      counterparty: draft.counterparty.trim() || undefined,
      note: draft.note.trim() || undefined,
    };
    if (editingId) onUpdate(entry);
    else onAdd(entry);
    setDraft({
      ...emptyDraft(draft.date),
      type: draft.type,
      accountId: draft.accountId,
    });
    setEditingId(null);
  }

  function editEntry(entry: LedgerEntry) {
    setAddOpen(true);
    setEditingId(entry.id);
    setDraft({
      date: entry.date,
      type: entry.type,
      accountId: entry.accountId,
      destinationAccountId: entry.destinationAccountId ?? '',
      amount: String(entry.amount),
      destinationAmount: entry.destinationAmount === undefined ? '' : String(entry.destinationAmount),
      categoryId: entry.categoryId ?? '',
      counterparty: entry.counterparty ?? '',
      note: entry.note ?? '',
    });
  }

  return (
    <FinanceCard
      title="Transactions"
      description="Transfers stay outside income and expense totals and update both accounts."
      action={
        <button type="button" className={financeStyles.secondary} onClick={() => setHoldingsOpen(true)}>
          View holdings
        </button>
      }
    >
      <HeldFundsModal open={holdingsOpen} onClose={() => setHoldingsOpen(false)} />
      {!readOnly ? (
        <div className={`${financeStyles.inset} mb-6`}>
          <CollapseToggle
            open={addOpen}
            title={editingId ? 'Edit transaction' : 'Add transaction'}
            subtitle={editingId ? 'Update the selected row' : 'Record income, expense, transfer, or fund movement'}
            onToggle={() => setAddOpen((value) => !value)}
          />
          {addOpen ? (
            <div className="grid gap-3 border-t border-white/6 p-4 md:grid-cols-2 xl:grid-cols-4">
              <EntryFields
                draft={draft}
                setDraft={setDraft}
                accounts={accounts}
                categories={categories}
                bounds={bounds}
                placeholders
              />
              <button
                type="button"
                className={`${financeStyles.primary} self-end`}
                disabled={draftIncomplete(draft, accounts)}
                onClick={addEntry}
              >
                {editingId ? 'Update transaction' : 'Add transaction'}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className={`${financeStyles.secondary} self-end`}
                  onClick={() => {
                    setEditingId(null);
                    setDraft(emptyDraft(draft.date));
                  }}
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <EntryFiltersPanel
        filters={filters}
        setFilters={applyFilters}
        accounts={accounts}
        categories={usedCategories}
        bounds={bounds}
        open={filtersOpen}
        onToggle={() => setFiltersOpen((value) => !value)}
        shownCount={visibleEntries.length}
        totalCount={entries.length}
      />

      <div className="space-y-3 md:hidden">
        {pageEntries.map((entry, index) => {
          const account = accounts.find((item) => item.id === entry.accountId);
          const destination = accounts.find((item) => item.id === entry.destinationAccountId);
          // Counted from the start of the filtered set, not the start of the
          // page, or page two would restart from the opening balance.
          const running = showRunning
            ? runningBalance(filters.accountId, visibleEntries.slice(0, firstOnPage + index + 1), accounts)
            : undefined;
          return (
            <article key={entry.id} className={`${financeStyles.inset} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">
                    {new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="mt-2 font-bold text-slate-100">{account?.name ?? 'Unknown account'}</p>
                  {destination ? <p className="mt-1 text-xs text-slate-500">to {destination.name}</p> : null}
                </div>
                <p className="shrink-0 text-right font-bold text-cyan-300">
                  {formatMoney(entry.amount, account?.currency ?? 'PKR')}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <TypeBadge type={entry.type} />
                {entryDetail(entry, categories) ? (
                  <span className="text-slate-400">{entryDetail(entry, categories)}</span>
                ) : null}
              </div>
              {entry.note ? <p className="mt-3 break-words text-xs leading-5 text-slate-500">{entry.note}</p> : null}
              {running !== undefined ? (
                <div className="mt-3 flex justify-between border-t border-white/6 pt-3 text-xs">
                  <span className="text-slate-500">Running balance</span>
                  <span className="font-bold text-cyan-300">
                    {formatMoney(running, accounts.find((item) => item.id === filters.accountId)?.currency ?? 'PKR')}
                  </span>
                </div>
              ) : null}
              {!readOnly ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" className={financeStyles.secondary} onClick={() => editEntry(entry)}>
                    Edit
                  </button>
                  <button type="button" className={financeStyles.danger} onClick={() => onRemove(entry.id)}>
                    Delete
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.12em] text-slate-600">
              <th className="border-b border-white/8 px-3 py-3 font-semibold">Date</th>
              <th className="border-b border-white/8 px-3 py-3 font-semibold">Type</th>
              <th className="border-b border-white/8 px-3 py-3 font-semibold">Account</th>
              <th className="border-b border-white/8 px-3 py-3 font-semibold">Details</th>
              <th className="border-b border-white/8 px-3 py-3 text-right font-semibold">Amount</th>
              <th className="border-b border-white/8 px-3 py-3 text-right font-semibold">
                {showRunning ? 'Running balance' : ''}
              </th>
              <th className="border-b border-white/8 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {pageEntries.map((entry, index) => {
              const account = accounts.find((item) => item.id === entry.accountId);
              const destination = accounts.find((item) => item.id === entry.destinationAccountId);
              const running = showRunning
                ? runningBalance(filters.accountId, visibleEntries.slice(0, firstOnPage + index + 1), accounts)
                : undefined;
              return (
                <tr key={entry.id} className="text-slate-300">
                  <td className="border-b border-white/5 px-3 py-4 text-slate-500">
                    {new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="border-b border-white/5 px-3 py-4">
                    <TypeBadge type={entry.type} />
                  </td>
                  <td className="border-b border-white/5 px-3 py-4">
                    {account?.name ?? 'Unknown'}
                    {destination ? <span className="block text-xs text-slate-600">to {destination.name}</span> : null}
                  </td>
                  <td className="border-b border-white/5 px-3 py-4">
                    <span>{entryDetail(entry, categories) || '—'}</span>
                    {entry.note ? (
                      <span className="block max-w-xs truncate text-xs text-slate-600">{entry.note}</span>
                    ) : null}
                  </td>
                  <td className="border-b border-white/5 px-3 py-4 text-right font-semibold">
                    {formatMoney(entry.amount, account?.currency ?? 'PKR')}
                  </td>
                  <td className="border-b border-white/5 px-3 py-4 text-right font-semibold text-cyan-300">
                    {running === undefined
                      ? ''
                      : formatMoney(running, accounts.find((item) => item.id === filters.accountId)?.currency ?? 'PKR')}
                  </td>
                  <td className="border-b border-white/5 px-3 py-4 text-right">
                    {!readOnly ? (
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                          onClick={() => editEntry(entry)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs font-semibold text-rose-400 hover:text-rose-300"
                          onClick={() => onRemove(entry.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visibleEntries.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-600">No transactions for this view.</p>
      ) : (
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          firstOnPage={firstOnPage}
          shown={pageEntries.length}
          total={visibleEntries.length}
          onPage={setPage}
          onPageSize={setPageSize}
        />
      )}
    </FinanceCard>
  );
}

/** A hold's counterparty occupies the column a category would otherwise use. */
function entryDetail(entry: LedgerEntry, categoryList: LedgerCategory[]) {
  if (!isHoldType(entry.type)) return categoryName(categoryList, entry.categoryId);
  return entry.counterparty ? `for ${entry.counterparty}` : '';
}

function Pagination({
  page,
  pageCount,
  pageSize,
  firstOnPage,
  shown,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  firstOnPage: number;
  shown: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-white/6 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-500">
        {firstOnPage + 1}–{firstOnPage + shown} of {total}
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Per page
          <select
            className={`${financeStyles.input} w-auto py-1.5`}
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        {/* Hidden rather than disabled on a single page: a lone "1 of 1" with
            two dead arrows is noise. */}
        {pageCount > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={financeStyles.secondary}
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
            >
              Previous
            </button>
            <span className="min-w-20 text-center text-xs text-slate-500">
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              className={financeStyles.secondary}
              disabled={page >= pageCount}
              onClick={() => onPage(page + 1)}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function runningBalance(accountId: string, entries: LedgerEntry[], accounts: LedgerAccount[]) {
  const account = accounts.find((item) => item.id === accountId);
  if (!account) return 0;
  return entries.reduce((balance, entry) => balance + accountMovement(accountId, entry), account.openingBalance);
}

const TYPE_BADGE: Record<LedgerEntryType, string> = {
  income: 'border-emerald-400/25 bg-emerald-400/12 text-emerald-300',
  expense: 'border-rose-400/25 bg-rose-400/12 text-rose-300',
  transfer: 'border-cyan-400/25 bg-cyan-400/12 text-cyan-300',
  fund_contribution: 'border-amber-400/25 bg-amber-400/12 text-amber-300',
  fund_withdrawal: 'border-violet-400/25 bg-violet-400/12 text-violet-300',
  // Holds are deliberately the same colour in both directions: they are one
  // concept moving two ways, not an income and an expense.
  hold_received: 'border-sky-400/25 bg-sky-400/12 text-sky-300',
  hold_returned: 'border-sky-400/25 bg-sky-400/12 text-sky-300',
};

function TypeBadge({ type }: { type: LedgerEntryType }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${TYPE_BADGE[type]}`}>
      {ENTRY_LABELS[type]}
    </span>
  );
}

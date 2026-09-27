'use client';

import { accountMovement, categoryName, ENTRY_LABELS, monthBounds } from '@/lib/ledger';
import type { LedgerAccount, LedgerCategory, LedgerEntry } from '@/types/ledger';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FinanceCard, financeStyles } from '../components/FinanceUI';
import { CollapseToggle } from './LedgerAccounts';
import { draftIncomplete, emptyDraft, EntryFields } from './EntryFields';
import { HeldFundsModal } from './HeldFundsModal';
import { EntryCards, entryDetail, EntryTable, type EntryRow } from './EntryRows';
import { PAGE_SIZES, Pagination } from './Pagination';
import {
  emptyFilters,
  EntryFiltersPanel,
  rememberFilters,
  rememberedFilters,
  type EntryFilters,
} from './EntryFiltersPanel';

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

  /**
   * Every value the two layouts need, derived once.
   *
   * The phone cards and the desktop table used to each look up the account,
   * the destination and the detail text for themselves, and each re-reduced
   * the whole filtered list to get a running balance — quadratic in the
   * number of transactions. One pass with an accumulator does all of it.
   */
  const rows = useMemo<EntryRow[]>(() => {
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const filtered = byId.get(filters.accountId);
    let balance = filtered?.openingBalance ?? 0;

    return visibleEntries.map((entry) => {
      if (filtered) balance += accountMovement(filtered.id, entry);
      return {
        entry,
        account: byId.get(entry.accountId),
        destination: entry.destinationAccountId ? byId.get(entry.destinationAccountId) : undefined,
        detail: entryDetail(entry, categories),
        running: showRunning ? balance : undefined,
      };
    });
  }, [visibleEntries, accounts, categories, filters.accountId, showRunning]);

  const runningCurrency = accounts.find((account) => account.id === filters.accountId)?.currency ?? 'PKR';

  const pageCount = Math.max(1, Math.ceil(visibleEntries.length / pageSize));
  // Clamped rather than corrected in state: deleting the last row of the last
  // page should show the page before it, not an empty table.
  const currentPage = Math.min(page, pageCount);
  const firstOnPage = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(firstOnPage, firstOnPage + pageSize);

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

      <EntryCards
        rows={pageRows}
        readOnly={readOnly}
        runningCurrency={runningCurrency}
        onEdit={editEntry}
        onRemove={onRemove}
      />
      <EntryTable
        rows={pageRows}
        showRunning={showRunning}
        readOnly={readOnly}
        runningCurrency={runningCurrency}
        onEdit={editEntry}
        onRemove={onRemove}
      />
      {visibleEntries.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-600">No transactions for this view.</p>
      ) : (
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          firstOnPage={firstOnPage}
          shown={pageRows.length}
          total={visibleEntries.length}
          onPage={setPage}
          onPageSize={setPageSize}
        />
      )}
    </FinanceCard>
  );
}

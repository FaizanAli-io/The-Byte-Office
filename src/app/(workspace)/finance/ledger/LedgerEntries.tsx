'use client';

import { accountMovement, monthBounds } from '@/lib/ledger';
import type { LedgerAccount, LedgerCategory, LedgerEntry } from '@/types/ledger';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FinanceCard, financeStyles } from '../components/FinanceUI';
import { draftFromEntry, draftIncomplete, emptyDraft, EntryFields } from './EntryFields';
import { Modal } from '../components/Modal';
import { HeldFundsModal } from './HeldFundsModal';
import { EntryCards, entryDetail, EntryTable, type EntryRow } from './EntryRows';
import { PAGE_SIZES, Pagination } from './Pagination';
import {
  applyEntryFilters,
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
  const [entryOpen, setEntryOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [holdingsOpen, setHoldingsOpen] = useState(false);

  const optionsRef = useRef<{ accounts: string[]; categories: string[] }>({ accounts: [], categories: [] });

  useEffect(() => {
    setDraft(emptyDraft(bounds.min));
    setEditingId(null);
    const stored = rememberedFilters();
    const known = optionsRef.current;
    setFilters({
      ...stored,
      accountId: known.accounts.includes(stored.accountId) ? stored.accountId : 'all',
      category: known.categories.includes(stored.category) ? stored.category : 'all',
    });
  }, [bounds.min]);

  function applyFilters(next: EntryFilters) {
    rememberFilters(next);
    setFilters(next);
  }

  const usedCategories = useMemo(
    () =>
      categories
        .filter((category) => entries.some((entry) => entry.categoryId === category.id))
        .map((category) => ({ id: category.id, name: category.name })),
    [categories, entries]
  );

  const visibleEntries = useMemo(
    () => applyEntryFilters(entries, filters, accounts, categories),
    [accounts, categories, entries, filters]
  );
  optionsRef.current = {
    accounts: ['all', ...accounts.map((account) => account.id)],
    categories: ['all', ...usedCategories.map((category) => category.id)],
  };

  const showRunning = filters.accountId !== 'all' && filters.sortBy === 'date';
  const sourceAccount = accounts.find((account) => account.id === draft.accountId);

  const rows = useMemo<EntryRow[]>(() => {
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const filtered = byId.get(filters.accountId);
    const balances = new Map<string, number>();
    if (filtered && showRunning) {
      let balance = filtered.openingBalance;
      // The date sort breaks ties by id, so newest-first is exactly oldest-first reversed.
      const chronological = filters.sortDir === 'asc' ? visibleEntries : [...visibleEntries].reverse();
      for (const entry of chronological) balances.set(entry.id, (balance += accountMovement(filtered.id, entry)));
    }

    return visibleEntries.map((entry) => ({
      entry,
      account: byId.get(entry.accountId),
      destination: entry.destinationAccountId ? byId.get(entry.destinationAccountId) : undefined,
      detail: entryDetail(entry, categories),
      running: balances.get(entry.id),
    }));
  }, [visibleEntries, accounts, categories, filters.accountId, filters.sortDir, showRunning]);

  const runningCurrency = accounts.find((account) => account.id === filters.accountId)?.currency ?? 'PKR';

  const pageCount = Math.max(1, Math.ceil(visibleEntries.length / pageSize));
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
    showEntry(false, { ...emptyDraft(draft.date), type: draft.type, accountId: draft.accountId });
  }

  function showEntry(open: boolean, next = emptyDraft(draft.date), id: string | null = null) {
    setEntryOpen(open);
    setEditingId(id);
    setDraft(next);
  }

  const closeEntry = () => showEntry(false);
  const rowProps = {
    rows: pageRows,
    readOnly,
    runningCurrency,
    onEdit: (entry: LedgerEntry) => showEntry(true, draftFromEntry(entry), entry.id),
    onRemove,
  };

  return (
    <FinanceCard
      title="Transactions"
      description="Transfers stay outside income and expense totals and update both accounts."
      action={
        <div className="flex flex-wrap gap-2">
          {!readOnly ? (
            <button type="button" className={financeStyles.primary} onClick={() => showEntry(true)}>
              Add transaction
            </button>
          ) : null}
          <button type="button" className={financeStyles.secondary} onClick={() => setHoldingsOpen(true)}>
            View holdings
          </button>
        </div>
      }
    >
      <HeldFundsModal open={holdingsOpen} onClose={() => setHoldingsOpen(false)} />
      <Modal
        open={entryOpen}
        onClose={closeEntry}
        title={editingId ? 'Edit transaction' : 'Add transaction'}
        description={
          editingId ? 'Update the selected row.' : 'Record income, expense, transfer, hold, or fund movement.'
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <EntryFields
            draft={draft}
            setDraft={setDraft}
            accounts={accounts}
            categories={categories}
            bounds={bounds}
            placeholders
          />
        </div>
        <div className="mt-5 flex flex-col gap-2 border-t border-white/6 pt-4 sm:flex-row sm:justify-end">
          <button type="button" className={financeStyles.secondary} onClick={closeEntry}>
            Cancel
          </button>
          <button
            type="button"
            className={financeStyles.primary}
            disabled={draftIncomplete(draft, accounts)}
            onClick={addEntry}
          >
            {editingId ? 'Update transaction' : 'Add transaction'}
          </button>
        </div>
      </Modal>

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

      <EntryCards {...rowProps} />
      <EntryTable {...rowProps} showRunning={showRunning} />
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

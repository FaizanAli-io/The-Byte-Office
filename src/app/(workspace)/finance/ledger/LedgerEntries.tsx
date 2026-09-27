'use client';

import { accountMovement, categoryName, ENTRY_LABELS, formatMoney, isHoldType, monthBounds } from '@/lib/ledger';
import type { LedgerAccount, LedgerCategory, LedgerEntry, LedgerEntryType } from '@/types/ledger';
import { useEffect, useMemo, useState } from 'react';
import { FinanceCard, financeStyles } from '../components/FinanceUI';
import { CollapseToggle } from './LedgerAccounts';
import { draftIncomplete, emptyDraft, EntryFields } from './EntryFields';
import { emptyFilters, EntryFiltersPanel, type EntryFilters } from './EntryFiltersPanel';

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
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setDraft(emptyDraft(bounds.min));
    setEditingId(null);
    setFilters(emptyFilters);
  }, [bounds.min]);

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
  const showRunning = filters.accountId !== 'all' && filters.sortBy === 'date' && filters.sortDir === 'asc';
  const sourceAccount = accounts.find((account) => account.id === draft.accountId);

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
    >
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
        setFilters={setFilters}
        accounts={accounts}
        categories={usedCategories}
        bounds={bounds}
        open={filtersOpen}
        onToggle={() => setFiltersOpen((value) => !value)}
        shownCount={visibleEntries.length}
        totalCount={entries.length}
      />

      <div className="space-y-3 md:hidden">
        {visibleEntries.map((entry, index) => {
          const account = accounts.find((item) => item.id === entry.accountId);
          const destination = accounts.find((item) => item.id === entry.destinationAccountId);
          const running = showRunning
            ? runningBalance(filters.accountId, visibleEntries.slice(0, index + 1), accounts)
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
            {visibleEntries.map((entry, index) => {
              const account = accounts.find((item) => item.id === entry.accountId);
              const destination = accounts.find((item) => item.id === entry.destinationAccountId);
              const running = showRunning
                ? runningBalance(filters.accountId, visibleEntries.slice(0, index + 1), accounts)
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
      ) : null}
    </FinanceCard>
  );
}

/** A hold's counterparty occupies the column a category would otherwise use. */
function entryDetail(entry: LedgerEntry, categoryList: LedgerCategory[]) {
  if (!isHoldType(entry.type)) return categoryName(categoryList, entry.categoryId);
  return entry.counterparty ? `for ${entry.counterparty}` : '';
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

'use client';

import { ENTRY_LABELS, categoryName, formatMoney, isHoldType } from '@/lib/ledger';
import type { LedgerAccount, LedgerCategory, LedgerEntry, LedgerEntryType } from '@/types/ledger';
import { financeStyles } from '../components/FinanceUI';

export type EntryRow = {
  entry: LedgerEntry;
  account?: LedgerAccount;
  destination?: LedgerAccount;
  detail: string;
  running?: number;
};

export type RowActions = {
  readOnly: boolean;
  runningCurrency: string;
  onEdit: (entry: LedgerEntry) => void;
  onRemove: (id: string) => void;
};

export function entryDetail(entry: LedgerEntry, categoryList: LedgerCategory[]) {
  if (!isHoldType(entry.type)) return categoryName(categoryList, entry.categoryId);
  return entry.counterparty ? `for ${entry.counterparty}` : '';
}

export function EntryCards({ rows, readOnly, runningCurrency, onEdit, onRemove }: RowActions & { rows: EntryRow[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {rows.map(({ entry, account, destination, detail, running }) => {
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
              {detail ? <span className="text-slate-400">{detail}</span> : null}
            </div>
            {entry.note ? <p className="mt-3 break-words text-xs leading-5 text-slate-500">{entry.note}</p> : null}
            {running !== undefined ? (
              <div className="mt-3 flex justify-between border-t border-white/6 pt-3 text-xs">
                <span className="text-slate-500">Running balance</span>
                <span className="font-bold text-cyan-300">{formatMoney(running, runningCurrency)}</span>
              </div>
            ) : null}
            {!readOnly ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" className={financeStyles.secondary} onClick={() => onEdit(entry)}>
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
  );
}

export function EntryTable({
  rows,
  showRunning,
  readOnly,
  runningCurrency,
  onEdit,
  onRemove,
}: RowActions & { rows: EntryRow[]; showRunning: boolean }) {
  return (
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
          {rows.map(({ entry, account, destination, detail, running }) => {
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
                  <span>{detail || '—'}</span>
                  {entry.note ? (
                    <span className="block max-w-xs truncate text-xs text-slate-600">{entry.note}</span>
                  ) : null}
                </td>
                <td className="border-b border-white/5 px-3 py-4 text-right font-semibold">
                  {formatMoney(entry.amount, account?.currency ?? 'PKR')}
                </td>
                <td className="border-b border-white/5 px-3 py-4 text-right font-semibold text-cyan-300">
                  {running === undefined ? '' : formatMoney(running, runningCurrency)}
                </td>
                <td className="border-b border-white/5 px-3 py-4 text-right">
                  {!readOnly ? (
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                        onClick={() => onEdit(entry)}
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
  );
}

const TYPE_BADGE: Record<LedgerEntryType, string> = {
  income: 'border-emerald-400/25 bg-emerald-400/12 text-emerald-300',
  expense: 'border-rose-400/25 bg-rose-400/12 text-rose-300',
  transfer: 'border-cyan-400/25 bg-cyan-400/12 text-cyan-300',
  fund_contribution: 'border-amber-400/25 bg-amber-400/12 text-amber-300',
  fund_withdrawal: 'border-violet-400/25 bg-violet-400/12 text-violet-300',
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

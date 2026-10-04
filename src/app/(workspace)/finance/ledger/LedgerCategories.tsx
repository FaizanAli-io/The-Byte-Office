'use client';

import { useState } from 'react';
import type { CategoryInput } from '@/lib/api-client';
import { formatMoney } from '@/lib/ledger';
import { CATEGORY_KINDS, type CategoryKind, type LedgerCategory } from '@/types/ledger';
import { CollapseToggle, FinanceCard, financeStyles } from '../components/FinanceUI';

const KIND_LABELS: Record<CategoryKind, string> = {
  income: 'Income only',
  expense: 'Expense only',
  both: 'Either',
};

type Totals = Map<string, { income: number; expense: number }>;

const th = `${financeStyles.th} sticky top-0 z-10 bg-slate-950`;

export function LedgerCategories({
  categories,
  totals,
  saving,
  readOnly,
  onSave,
  onRemove,
}: {
  categories: LedgerCategory[];
  totals: Totals;
  saving: boolean;
  readOnly: boolean;
  onSave: (input: CategoryInput) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('both');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const active = categories.filter((category) => !category.archivedAt);
  const archived = categories.filter((category) => category.archivedAt);

  const volume = (id: string) => (totals.get(id)?.income ?? 0) + (totals.get(id)?.expense ?? 0);
  const byTotal = (list: LedgerCategory[]) =>
    [...list].sort((a, b) => volume(b.id) - volume(a.id) || b.entryCount - a.entryCount);
  const ordered = [...byTotal(active), ...byTotal(archived)];

  function add() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), kind });
    setName('');
    setKind('both');
  }

  return (
    <FinanceCard title="Categories" description="One canonical list, shared by every month and by the assistant.">
      <div className={financeStyles.inset}>
        <CollapseToggle
          open={open}
          title={`${active.length} ${active.length === 1 ? 'category' : 'categories'}`}
          subtitle={archived.length ? `${archived.length} archived` : 'Rename, archive, or add a new one'}
          onToggle={() => setOpen((value) => !value)}
        />
        {open ? (
          <div className="border-t border-white/6 p-4">
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className={financeStyles.tableHead}>
                    <th className={th}>Name</th>
                    <th className={th}>Applies to</th>
                    <th className={th}>Status</th>
                    <th className={`${th} text-right`}>This month</th>
                    <th className={`${th} w-px text-center`}>Used</th>
                    <th className={`${th} text-right`} />
                  </tr>
                </thead>
                <tbody>
                  {!readOnly ? (
                    <tr>
                      <td className={financeStyles.td}>
                        <input
                          className={financeStyles.input}
                          value={name}
                          placeholder="New category"
                          disabled={saving}
                          onChange={(event) => setName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') add();
                          }}
                        />
                      </td>
                      <td className={financeStyles.td}>
                        <KindSelect value={kind} disabled={saving} onChange={setKind} />
                      </td>
                      <td className={`${financeStyles.td} text-xs text-slate-600`}>New</td>
                      <td className={financeStyles.td} />
                      <td className={`${financeStyles.td} w-px`} />
                      <td className={`${financeStyles.td} text-right`}>
                        <button
                          type="button"
                          className={financeStyles.primary}
                          disabled={saving || !name.trim()}
                          onClick={add}
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  ) : null}

                  {ordered.map((category) => (
                    <CategoryRow
                      key={category.id}
                      category={category}
                      totals={totals.get(category.id)}
                      saving={saving}
                      readOnly={readOnly}
                      confirmingDelete={pendingDelete === category.id}
                      onSave={onSave}
                      onDelete={() => {
                        if (pendingDelete !== category.id) {
                          setPendingDelete(category.id);
                          return;
                        }
                        setPendingDelete(null);
                        onRemove(category.id);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {!ordered.length ? <p className="py-6 text-center text-sm text-slate-600">No categories yet.</p> : null}
          </div>
        ) : null}
      </div>
    </FinanceCard>
  );
}

function CategoryRow({
  category,
  totals,
  saving,
  readOnly,
  confirmingDelete,
  onSave,
  onDelete,
}: {
  category: LedgerCategory;
  totals?: { income: number; expense: number };
  saving: boolean;
  readOnly: boolean;
  confirmingDelete: boolean;
  onSave: (input: CategoryInput) => void;
  onDelete: () => void;
}) {
  const [draftName, setDraftName] = useState(category.name);
  const archived = Boolean(category.archivedAt);

  return (
    <tr className={archived ? 'opacity-60' : ''}>
      <td className={financeStyles.td}>
        <input
          className={financeStyles.input}
          value={draftName}
          disabled={saving || readOnly}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={() => {
            const next = draftName.trim();
            if (!next) {
              setDraftName(category.name);
              return;
            }
            if (next !== category.name) onSave({ id: category.id, name: next });
          }}
        />
      </td>
      <td className={financeStyles.td}>
        <KindSelect
          value={category.kind}
          disabled={saving || readOnly}
          onChange={(kind) => onSave({ id: category.id, kind })}
        />
      </td>
      <td className={financeStyles.td}>
        <span className={`text-xs font-semibold ${archived ? 'text-slate-500' : 'text-emerald-300'}`}>
          {archived ? 'Archived' : 'Active'}
        </span>
      </td>
      <td className={`${financeStyles.td} text-right text-xs font-semibold tabular-nums`}>
        {totals?.income ? <p className="text-emerald-300">+{formatMoney(totals.income, 'PKR')}</p> : null}
        {totals?.expense ? <p className="text-rose-300">−{formatMoney(totals.expense, 'PKR')}</p> : null}
        {!totals?.income && !totals?.expense ? <span className="text-slate-600">—</span> : null}
      </td>
      <td className={`${financeStyles.td} w-px text-center`}>
        <span
          title={`${category.entryCount} ${category.entryCount === 1 ? 'entry uses' : 'entries use'} this category`}
          className={`inline-flex min-w-7 justify-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${
            category.entryCount
              ? 'border-cyan-400/25 bg-cyan-400/10 text-cyan-300'
              : 'border-white/8 bg-white/[0.03] text-slate-600'
          }`}
        >
          {category.entryCount}
        </span>
      </td>
      <td className={`${financeStyles.td} text-right`}>
        {!readOnly ? (
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
              disabled={saving}
              onClick={() => onSave({ id: category.id, archived: !archived })}
            >
              {archived ? 'Restore' : 'Archive'}
            </button>
            <button
              type="button"
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 disabled:opacity-50"
              disabled={saving || category.entryCount > 0}
              title={category.entryCount ? 'In use by an entry — archive it instead' : undefined}
              onClick={onDelete}
            >
              {confirmingDelete ? 'Confirm' : 'Delete'}
            </button>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

function KindSelect({
  value,
  disabled,
  onChange,
}: {
  value: CategoryKind;
  disabled: boolean;
  onChange: (kind: CategoryKind) => void;
}) {
  return (
    <select
      className={financeStyles.input}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as CategoryKind)}
    >
      {CATEGORY_KINDS.map((kind) => (
        <option key={kind} value={kind}>
          {KIND_LABELS[kind]}
        </option>
      ))}
    </select>
  );
}

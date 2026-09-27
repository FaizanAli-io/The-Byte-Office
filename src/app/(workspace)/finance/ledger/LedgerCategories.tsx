'use client';

import { useState } from 'react';
import { CATEGORY_KINDS, type CategoryKind, type LedgerCategory } from '@/types/ledger';
import { FinanceCard, financeStyles } from '../components/FinanceUI';
import { CollapseToggle } from './LedgerAccounts';

/**
 * The canonical category list, managed where categories are used.
 *
 * Categories are global rather than per-month, so this table does not belong
 * to the ledger being viewed — but a settings page holding a single list is a
 * page nobody remembers exists.
 *
 * Archiving, not deleting, is the ordinary way to retire a category: entries
 * that used it keep their label. Deleting is only for a category nothing
 * points at, and the API refuses the rest with a count.
 *
 * Collapsed by default, because the list is picked from far more often than
 * it is edited and it sits above the transactions people came for.
 */

const KIND_LABELS: Record<CategoryKind, string> = {
  income: 'Income only',
  expense: 'Expense only',
  both: 'Either',
};

type SaveInput = { id?: string; name?: string; kind?: CategoryKind; archived?: boolean };

export function LedgerCategories({
  categories,
  saving,
  readOnly,
  onSave,
  onRemove,
}: {
  categories: LedgerCategory[];
  saving: boolean;
  readOnly: boolean;
  onSave: (input: SaveInput) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('both');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // Active first, then archived, so the list people actually pick from is at
  // the top and retired names stay visible without being in the way. The two
  // counts also make up the collapsed summary.
  const active = categories.filter((category) => !category.archivedAt);
  const archived = categories.filter((category) => category.archivedAt);

  // Most-used first within each group, which puts the unused ones — the only
  // ones that can be deleted — together at the bottom. The sort is stable, so
  // equal counts keep the canonical order the API returned them in.
  const byUsage = (list: LedgerCategory[]) => [...list].sort((a, b) => b.entryCount - a.entryCount);
  const ordered = [...byUsage(active), ...byUsage(archived)];

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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.12em] text-slate-600">
                    <th className="border-b border-white/8 px-3 py-3 font-semibold">Name</th>
                    <th className="border-b border-white/8 px-3 py-3 font-semibold">Applies to</th>
                    <th className="border-b border-white/8 px-3 py-3 font-semibold">Status</th>
                    {/* `w-px` collapses the column to its content, so the badge
                        does not claim a share of the leftover width. */}
                    <th className="w-px border-b border-white/8 px-3 py-3 text-center font-semibold">Used</th>
                    <th className="border-b border-white/8 px-3 py-3 text-right font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {!readOnly ? (
                    <tr>
                      <td className="border-b border-white/5 px-3 py-3">
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
                      <td className="border-b border-white/5 px-3 py-3">
                        <KindSelect value={kind} disabled={saving} onChange={setKind} />
                      </td>
                      <td className="border-b border-white/5 px-3 py-3 text-xs text-slate-600">New</td>
                      <td className="w-px border-b border-white/5 px-3 py-3" />
                      <td className="border-b border-white/5 px-3 py-3 text-right">
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
  saving,
  readOnly,
  confirmingDelete,
  onSave,
  onDelete,
}: {
  category: LedgerCategory;
  saving: boolean;
  readOnly: boolean;
  confirmingDelete: boolean;
  onSave: (input: SaveInput) => void;
  onDelete: () => void;
}) {
  // Renaming commits on blur rather than on every keystroke, since each save
  // is a round trip and a rename rewrites what every entry displays.
  const [draftName, setDraftName] = useState(category.name);
  const archived = Boolean(category.archivedAt);

  return (
    <tr className={archived ? 'opacity-60' : ''}>
      <td className="border-b border-white/5 px-3 py-3">
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
      <td className="border-b border-white/5 px-3 py-3">
        <KindSelect
          value={category.kind}
          disabled={saving || readOnly}
          onChange={(kind) => onSave({ id: category.id, kind })}
        />
      </td>
      <td className="border-b border-white/5 px-3 py-3">
        <span className={`text-xs font-semibold ${archived ? 'text-slate-500' : 'text-emerald-300'}`}>
          {archived ? 'Archived' : 'Active'}
        </span>
      </td>
      {/* Zero means nothing references it, which is the only state in which
          Delete will succeed — the API refuses the rest. */}
      <td className="w-px border-b border-white/5 px-3 py-3 text-center">
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
      <td className="border-b border-white/5 px-3 py-3 text-right">
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

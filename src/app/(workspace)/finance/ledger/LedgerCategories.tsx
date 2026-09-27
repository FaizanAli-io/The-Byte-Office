'use client';

import { useState } from 'react';
import { CATEGORY_KINDS, type CategoryKind, type LedgerCategory } from '@/types/ledger';
import { FinanceCard, financeStyles } from '../components/FinanceUI';
import { CollapseToggle, Field } from './LedgerAccounts';

/**
 * The canonical category list, managed in the one place categories are used.
 *
 * Categories are global rather than per-month, so this card does not belong
 * to the ledger being viewed — but a separate settings page for a single list
 * would be a page nobody remembers exists. It stays collapsed by default
 * because the list is edited far less often than it is picked from.
 *
 * Archiving, not deleting, is the ordinary way to retire a category: the
 * entries that used it keep their label. Deleting is offered only for a
 * category nothing points at, and the API refuses the rest with a count.
 */

const KIND_LABELS: Record<CategoryKind, string> = {
  income: 'Income only',
  expense: 'Expense only',
  both: 'Either',
};

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
  onSave: (input: { id?: string; name?: string; kind?: CategoryKind; archived?: boolean }) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('both');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const active = categories.filter((category) => !category.archivedAt);
  const archived = categories.filter((category) => category.archivedAt);

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
          <div className="space-y-3 border-t border-white/6 p-4">
            {!readOnly ? (
              <div className={`${financeStyles.inset} grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]`}>
                <Field label="New category">
                  <input
                    className={financeStyles.input}
                    value={name}
                    placeholder="Groceries"
                    disabled={saving}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') add();
                    }}
                  />
                </Field>
                <Field label="Applies to">
                  <KindSelect value={kind} disabled={saving} onChange={setKind} />
                </Field>
                <div className="flex items-end">
                  <button
                    type="button"
                    className={financeStyles.primary}
                    disabled={saving || !name.trim()}
                    onClick={add}
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : null}

            {!categories.length ? (
              <p className="py-6 text-center text-sm text-slate-600">No categories yet.</p>
            ) : (
              [...active, ...archived].map((category) => (
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
              ))
            )}
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
  onSave: (input: { id?: string; name?: string; kind?: CategoryKind; archived?: boolean }) => void;
  onDelete: () => void;
}) {
  // Renaming commits on blur rather than on every keystroke, since each save
  // is a round trip and a rename rewrites what every entry displays.
  const [draftName, setDraftName] = useState(category.name);
  const archived = Boolean(category.archivedAt);

  return (
    <div
      className={`${financeStyles.inset} grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end ${
        archived ? 'opacity-60' : ''
      }`}
    >
      <Field label={archived ? 'Archived' : 'Name'}>
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
      </Field>
      <Field label="Applies to">
        <KindSelect
          value={category.kind}
          disabled={saving || readOnly}
          onChange={(kind) => onSave({ id: category.id, kind })}
        />
      </Field>
      <div className="flex gap-2">
        {!readOnly ? (
          <>
            <button
              type="button"
              className={financeStyles.secondary}
              disabled={saving}
              onClick={() => onSave({ id: category.id, archived: !archived })}
            >
              {archived ? 'Restore' : 'Archive'}
            </button>
            <button type="button" className={financeStyles.danger} disabled={saving} onClick={onDelete}>
              {confirmingDelete ? 'Confirm' : 'Delete'}
            </button>
          </>
        ) : null}
      </div>
    </div>
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

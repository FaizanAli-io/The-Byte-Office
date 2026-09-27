'use client';

import { eligibleAccounts, monthBounds } from '@/lib/ledger';
import type { LedgerEntryFormState } from '@/lib/finance-agent/types';
import type { LedgerEntryType } from '@/types/ledger';
import { FormEvent, useState } from 'react';
import { financeStyles } from '../../components/FinanceUI';
import { draftIncomplete, firstOtherAccountId, EntryFields, type EntryDraft } from '../../ledger/EntryFields';

export function LedgerEntryChatForm({
  form,
  busy,
  onSubmit,
  onCancel,
}: {
  form: LedgerEntryFormState;
  busy: boolean;
  onSubmit: (entry: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => draftFromForm(form));
  const sourceAccount = form.accounts.find((account) => account.id === draft.accountId);

  function submit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(draft.amount);
    if (!draft.accountId || !draft.date || !Number.isFinite(amount) || amount <= 0) return;

    onSubmit({
      id: form.entry.id,
      date: draft.date,
      type: draft.type,
      accountId: draft.accountId,
      destinationAccountId: draft.type === 'transfer' ? draft.destinationAccountId : undefined,
      amount,
      destinationAmount:
        draft.type === 'transfer' && draft.destinationAmount ? Number(draft.destinationAmount) : undefined,
      exchangeRate: sourceAccount?.exchangeRate ?? 1,
      categoryId: draft.categoryId || undefined,
      counterparty: draft.counterparty.trim() || undefined,
      note: draft.note.trim() || undefined,
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      <EntryFields
        draft={draft}
        setDraft={setDraft}
        accounts={form.accounts}
        // A proposal made before categories existed was stored without a
        // list; an empty one renders "No category" rather than throwing.
        categories={form.categories ?? []}
        bounds={monthBounds(form.month)}
        disabled={busy}
      />
      <div className="flex flex-col gap-2 pt-1 md:col-span-2 sm:flex-row">
        <button
          type="submit"
          className={financeStyles.primary}
          disabled={busy || draftIncomplete(draft, form.accounts)}
        >
          {busy ? 'Saving…' : form.kind === 'ledger_entry_update' ? 'Save entry' : 'Add entry'}
        </button>
        <button type="button" className={financeStyles.secondary} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function draftFromForm(form: LedgerEntryFormState): EntryDraft {
  const type = form.entry.type ?? ('expense' as LedgerEntryType);
  const accountId = form.entry.accountId || eligibleAccounts(form.accounts, type)[0]?.id || '';
  return {
    date: form.entry.date,
    type,
    accountId,
    destinationAccountId:
      form.entry.destinationAccountId || (type === 'transfer' ? firstOtherAccountId(form.accounts, accountId) : ''),
    amount: form.entry.amount === undefined ? '' : String(form.entry.amount),
    destinationAmount: form.entry.destinationAmount === undefined ? '' : String(form.entry.destinationAmount),
    categoryId: form.entry.categoryId ?? '',
    counterparty: form.entry.counterparty ?? '',
    note: form.entry.note ?? '',
  };
}

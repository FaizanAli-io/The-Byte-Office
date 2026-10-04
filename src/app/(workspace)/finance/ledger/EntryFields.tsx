'use client';

import { ENTRY_LABELS, eligibleAccounts, isHoldType, pickableCategories } from '@/lib/ledger';
import type { LedgerAccount, LedgerCategory, LedgerEntryType } from '@/types/ledger';
import { financeStyles } from '../components/FinanceUI';
import { Field } from './LedgerAccounts';

export type EntryAccount = Pick<LedgerAccount, 'id' | 'name' | 'currency' | 'type' | 'exchangeRate'>;

export type EntryDraft = {
  date: string;
  type: LedgerEntryType;
  accountId: string;
  destinationAccountId: string;
  amount: string;
  destinationAmount: string;
  categoryId: string;
  counterparty: string;
  note: string;
};

export function emptyDraft(date: string): EntryDraft {
  return {
    date,
    type: 'expense',
    accountId: '',
    destinationAccountId: '',
    amount: '',
    destinationAmount: '',
    categoryId: '',
    counterparty: '',
    note: '',
  };
}

export function firstOtherAccountId(accounts: EntryAccount[], accountId: string) {
  return accounts.find((account) => account.id !== accountId)?.id ?? '';
}

function conversionTarget(draft: EntryDraft, accounts: EntryAccount[]) {
  if (draft.type !== 'transfer') return null;
  const source = accounts.find((account) => account.id === draft.accountId);
  const destination = accounts.find((account) => account.id === draft.destinationAccountId);
  if (!source || !destination || source.currency === destination.currency) return null;
  return destination;
}

export function draftIncomplete(draft: EntryDraft, accounts: EntryAccount[]) {
  return (
    !draft.accountId ||
    !draft.amount ||
    (draft.type === 'transfer' && !draft.destinationAccountId) ||
    (Boolean(conversionTarget(draft, accounts)) && !draft.destinationAmount)
  );
}

function AccountOptions({ accounts }: { accounts: EntryAccount[] }) {
  return accounts.map((account) => (
    <option key={account.id} value={account.id}>
      {account.name} · {account.currency}
    </option>
  ));
}

export function EntryFields({
  draft,
  setDraft,
  accounts,
  categories,
  bounds,
  disabled = false,
  placeholders = false,
}: {
  draft: EntryDraft;
  setDraft: (draft: EntryDraft) => void;
  accounts: EntryAccount[];
  categories: LedgerCategory[];
  bounds: { min: string; max: string };
  disabled?: boolean;
  placeholders?: boolean;
}) {
  const eligible = eligibleAccounts(accounts, draft.type);
  const target = conversionTarget(draft, accounts);
  const pickable = pickableCategories(categories, draft.type, draft.categoryId || undefined);

  function changeType(type: LedgerEntryType) {
    const next = eligibleAccounts(accounts, type);
    const accountId = next.some((account) => account.id === draft.accountId)
      ? draft.accountId
      : placeholders
        ? ''
        : (next[0]?.id ?? '');
    const keepsCategory =
      !isHoldType(type) && pickableCategories(categories, type, undefined).some((item) => item.id === draft.categoryId);
    setDraft({
      ...draft,
      type,
      accountId,
      destinationAccountId: type === 'transfer' && !placeholders ? firstOtherAccountId(accounts, accountId) : '',
      categoryId: keepsCategory ? draft.categoryId : '',
      counterparty: isHoldType(type) ? draft.counterparty : '',
    });
  }

  return (
    <>
      <Field label="Date">
        <input
          className={financeStyles.input}
          type="date"
          min={bounds.min}
          max={bounds.max}
          value={draft.date}
          disabled={disabled}
          onChange={(event) => setDraft({ ...draft, date: event.target.value })}
        />
      </Field>
      <Field label="Type">
        <select
          className={financeStyles.input}
          value={draft.type}
          disabled={disabled}
          onChange={(event) => changeType(event.target.value as LedgerEntryType)}
        >
          {Object.entries(ENTRY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={draft.type === 'transfer' ? 'From account' : 'Account'}>
        <select
          className={financeStyles.input}
          value={draft.accountId}
          disabled={disabled}
          onChange={(event) => setDraft({ ...draft, accountId: event.target.value })}
        >
          {placeholders ? <option value="">Select account</option> : null}
          <AccountOptions accounts={eligible} />
        </select>
      </Field>
      <Field label="Amount">
        <input
          className={financeStyles.input}
          type="number"
          min="0"
          step="any"
          value={draft.amount}
          disabled={disabled}
          placeholder="0"
          onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
        />
      </Field>
      {draft.type === 'transfer' ? (
        <>
          <Field label="To account">
            <select
              className={financeStyles.input}
              value={draft.destinationAccountId}
              disabled={disabled}
              onChange={(event) => setDraft({ ...draft, destinationAccountId: event.target.value })}
            >
              {placeholders ? <option value="">Select destination</option> : null}
              <AccountOptions accounts={accounts.filter((account) => account.id !== draft.accountId)} />
            </select>
          </Field>
          <Field label={target ? `Amount received (${target.currency})` : 'Destination amount (optional)'}>
            <input
              className={financeStyles.input}
              type="number"
              min="0"
              step="any"
              value={draft.destinationAmount}
              disabled={disabled}
              placeholder="For currency conversion"
              onChange={(event) => setDraft({ ...draft, destinationAmount: event.target.value })}
            />
          </Field>
        </>
      ) : null}
      {isHoldType(draft.type) ? (
        <Field label="Counterparty (optional)">
          <input
            className={financeStyles.input}
            value={draft.counterparty}
            disabled={disabled}
            placeholder="Whose money is this?"
            onChange={(event) => setDraft({ ...draft, counterparty: event.target.value })}
          />
        </Field>
      ) : (
        <Field label="Category (optional)">
          <select
            className={financeStyles.input}
            value={draft.categoryId}
            disabled={disabled}
            onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
          >
            <option value="">No category</option>
            {pickable.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.archivedAt ? ' (archived)' : ''}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Note (optional)">
        <input
          className={financeStyles.input}
          value={draft.note}
          disabled={disabled}
          placeholder="Short description"
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
        />
      </Field>
    </>
  );
}

'use client';

import { PKR, splitTransfer, TRANSFER_CATEGORIES } from '@/lib/fx';
import { ENTRY_LABELS, eligibleAccounts, formatMoney, isHoldType, pickableCategories } from '@/lib/ledger';
import type { LedgerAccount, LedgerCategory, LedgerEntry, LedgerEntryType } from '@/types/ledger';
import { Field, SelectField, financeStyles, openPicker } from '../components/FinanceUI';

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

export function draftFromEntry(entry: LedgerEntry): EntryDraft {
  return {
    date: entry.date,
    type: entry.type,
    accountId: entry.accountId,
    destinationAccountId: entry.destinationAccountId ?? '',
    amount: String(entry.amount),
    destinationAmount: entry.destinationAmount === undefined ? '' : String(entry.destinationAmount),
    categoryId: entry.categoryId ?? '',
    counterparty: entry.counterparty ?? '',
    note: entry.note ?? '',
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
    !draft.date ||
    !draft.accountId ||
    !draft.amount ||
    (draft.type === 'transfer' && !draft.destinationAccountId) ||
    (Boolean(conversionTarget(draft, accounts)) && !draft.destinationAmount)
  );
}

const accountOptions = (accounts: EntryAccount[]) =>
  accounts.map((account): [string, string] => [account.id, `${account.name} · ${account.currency}`]);

export function EntryFields({
  draft,
  setDraft,
  accounts,
  categories,
  bounds,
  adding = false,
  disabled = false,
  placeholders = false,
}: {
  draft: EntryDraft;
  setDraft: (draft: EntryDraft) => void;
  accounts: EntryAccount[];
  categories: LedgerCategory[];
  bounds: { min: string; max: string };
  // A new transfer is entered as sent and received, and split on save; an edit saves the amounts as they are.
  adding?: boolean;
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
          onClick={openPicker}
          min={bounds.min}
          max={bounds.max}
          value={draft.date}
          disabled={disabled}
          onChange={(event) => setDraft({ ...draft, date: event.target.value })}
        />
      </Field>
      <SelectField
        label="Type"
        value={draft.type}
        disabled={disabled}
        onChange={(type) => changeType(type as LedgerEntryType)}
        options={Object.entries(ENTRY_LABELS)}
      />
      <SelectField
        label={draft.type === 'transfer' ? 'From account' : 'Account'}
        value={draft.accountId}
        disabled={disabled}
        onChange={(accountId) => setDraft({ ...draft, accountId })}
        options={accountOptions(eligible)}
      >
        {placeholders ? <option value="">Select account</option> : null}
      </SelectField>
      <Field label={draft.type === 'transfer' && adding ? 'Amount sent' : 'Amount'}>
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
          <SelectField
            label="To account"
            value={draft.destinationAccountId}
            disabled={disabled}
            onChange={(destinationAccountId) => setDraft({ ...draft, destinationAccountId })}
            options={accountOptions(accounts.filter((account) => account.id !== draft.accountId))}
          >
            {placeholders ? <option value="">Select destination</option> : null}
          </SelectField>
          <Field
            label={target ? `Amount received (${target.currency})` : `Amount received${adding ? ' (optional)' : ''}`}
          >
            <input
              className={financeStyles.input}
              type="number"
              min="0"
              step="any"
              value={draft.destinationAmount}
              disabled={disabled}
              placeholder={target ? '0' : draft.amount || 'Same as sent'}
              onChange={(event) => setDraft({ ...draft, destinationAmount: event.target.value })}
            />
          </Field>
          {adding ? <TransferPreview draft={draft} accounts={accounts} /> : null}
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
        <SelectField
          label="Category (optional)"
          value={draft.categoryId}
          disabled={disabled}
          onChange={(categoryId) => setDraft({ ...draft, categoryId })}
          options={[
            ['', 'No category'],
            ...pickable.map((category): [string, string] => [
              category.id,
              `${category.name}${category.archivedAt ? ' (archived)' : ''}`,
            ]),
          ]}
        />
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

// The split the server will write, at the live rates the page loaded; the server's rates at save time are final.
function TransferPreview({ draft, accounts }: { draft: EntryDraft; accounts: EntryAccount[] }) {
  const source = accounts.find((account) => account.id === draft.accountId);
  const destination = accounts.find((account) => account.id === draft.destinationAccountId);
  const sent = Number(draft.amount);
  const same = source?.currency === destination?.currency;
  const received = draft.destinationAmount ? Number(draft.destinationAmount) : same ? sent : NaN;
  if (!source || !destination || !(sent > 0) || !(received > 0)) return null;

  const split = splitTransfer({
    sent,
    received,
    source: { currency: source.currency, rate: source.exchangeRate },
    destination: { currency: destination.currency, rate: destination.exchangeRate },
  });

  let text: string;
  if ('error' in split) text = split.error;
  else if (!split.difference)
    text = same ? 'Arrives in full.' : 'Received at the market rate: no exchange cost or gain.';
  else {
    const { amount, type, category, note } = split.difference;
    const pkr = source.currency === PKR ? '' : ` (${formatMoney(amount * source.exchangeRate, PKR)})`;
    text = `${note ? `${note} · ` : ''}${TRANSFER_CATEGORIES[category].name} ${formatMoney(amount, source.currency)}${pkr} → ${type} on ${source.name}`;
  }
  return <p className={`text-xs md:col-span-2 ${'error' in split ? 'text-rose-300' : 'text-slate-400'}`}>{text}</p>;
}

"use client";

import { ENTRY_LABELS, monthBounds } from "@/lib/ledger";
import type { LedgerEntryFormState } from "@/lib/finance-agent/types";
import type { LedgerEntryType } from "@/types/ledger";
import { FormEvent, useMemo, useState } from "react";
import { financeStyles } from "../../components/FinanceUI";
import { Field } from "../../ledger/LedgerAccounts";

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
  const bounds = monthBounds(form.month);
  const [draft, setDraft] = useState(() => draftFromForm(form));
  const sourceAccount = form.accounts.find(
    (account) => account.id === draft.accountId,
  );
  const destinationAccount = form.accounts.find(
    (account) => account.id === draft.destinationAccountId,
  );
  const requiresDestinationAmount =
    draft.type === "transfer" &&
    Boolean(sourceAccount) &&
    Boolean(destinationAccount) &&
    sourceAccount?.currency !== destinationAccount?.currency;
  const eligible = useMemo(
    () => eligibleAccounts(form.accounts, draft.type),
    [draft.type, form.accounts],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(draft.amount);
    if (!draft.accountId || !draft.date || !Number.isFinite(amount) || amount <= 0) {
      return;
    }
    onSubmit({
      id: form.entry.id,
      date: draft.date,
      type: draft.type,
      accountId: draft.accountId,
      destinationAccountId:
        draft.type === "transfer" ? draft.destinationAccountId : undefined,
      amount,
      destinationAmount:
        draft.type === "transfer" && draft.destinationAmount
          ? Number(draft.destinationAmount)
          : undefined,
      exchangeRate: sourceAccount?.exchangeRate ?? 1,
      category: draft.category.trim() || undefined,
      note: draft.note.trim() || undefined,
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      <Field label="Date">
        <input
          className={financeStyles.input}
          type="date"
          min={bounds.min}
          max={bounds.max}
          value={draft.date}
          disabled={busy}
          onChange={(event) =>
            setDraft({ ...draft, date: event.target.value })
          }
        />
      </Field>
      <Field label="Type">
        <select
          className={financeStyles.input}
          value={draft.type}
          disabled={busy}
          onChange={(event) => {
            const type = event.target.value as LedgerEntryType;
            const nextAccounts = eligibleAccounts(form.accounts, type);
            const accountId = nextAccounts.some(
              (account) => account.id === draft.accountId,
            )
              ? draft.accountId
              : (nextAccounts[0]?.id ?? "");
            setDraft({
              ...draft,
              type,
              accountId,
              destinationAccountId:
                type === "transfer"
                  ? firstOtherAccountId(form.accounts, accountId)
                  : "",
            });
          }}
        >
          {Object.entries(ENTRY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={draft.type === "transfer" ? "From account" : "Account"}>
        <select
          className={financeStyles.input}
          value={draft.accountId}
          disabled={busy}
          onChange={(event) =>
            setDraft({ ...draft, accountId: event.target.value })
          }
        >
          {eligible.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} · {account.currency}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Amount">
        <input
          className={financeStyles.input}
          type="number"
          min="0"
          step="any"
          value={draft.amount}
          disabled={busy}
          placeholder="0"
          onChange={(event) =>
            setDraft({ ...draft, amount: event.target.value })
          }
        />
      </Field>
      {draft.type === "transfer" ? (
        <>
          <Field label="To account">
            <select
              className={financeStyles.input}
              value={draft.destinationAccountId}
              disabled={busy}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  destinationAccountId: event.target.value,
                })
              }
            >
              {form.accounts
                .filter((account) => account.id !== draft.accountId)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.currency}
                  </option>
                ))}
            </select>
          </Field>
          <Field
            label={
              requiresDestinationAmount
                ? `Amount received (${destinationAccount?.currency})`
                : "Destination amount (optional)"
            }
          >
            <input
              className={financeStyles.input}
              type="number"
              min="0"
              step="any"
              value={draft.destinationAmount}
              disabled={busy}
              placeholder="For currency conversion"
              onChange={(event) =>
                setDraft({
                  ...draft,
                  destinationAmount: event.target.value,
                })
              }
            />
          </Field>
        </>
      ) : null}
      <Field label="Category (optional)">
        <input
          className={financeStyles.input}
          value={draft.category}
          disabled={busy}
          placeholder="Salary, bills, food…"
          onChange={(event) =>
            setDraft({ ...draft, category: event.target.value })
          }
        />
      </Field>
      <Field label="Note (optional)">
        <input
          className={financeStyles.input}
          value={draft.note}
          disabled={busy}
          placeholder="Short description"
          onChange={(event) =>
            setDraft({ ...draft, note: event.target.value })
          }
        />
      </Field>
      <div className="flex flex-col gap-2 pt-1 md:col-span-2 sm:flex-row">
        <button
          type="submit"
          className={financeStyles.primary}
          disabled={
            busy ||
            !draft.accountId ||
            !draft.amount ||
            (draft.type === "transfer" && !draft.destinationAccountId) ||
            (Boolean(requiresDestinationAmount) && !draft.destinationAmount)
          }
        >
          {busy
            ? "Saving…"
            : form.kind === "ledger_entry_update"
              ? "Save entry"
              : "Add entry"}
        </button>
        <button
          type="button"
          className={financeStyles.secondary}
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function draftFromForm(form: LedgerEntryFormState) {
  const type = form.entry.type ?? ("expense" as LedgerEntryType);
  const accountId =
    form.entry.accountId ||
    eligibleAccounts(form.accounts, type)[0]?.id ||
    "";
  return {
    date: form.entry.date,
    type,
    accountId,
    destinationAccountId:
      form.entry.destinationAccountId ||
      (type === "transfer" ? firstOtherAccountId(form.accounts, accountId) : ""),
    amount:
      form.kind === "ledger_entry_add" || form.entry.amount === undefined
        ? ""
        : String(form.entry.amount),
    destinationAmount:
      form.entry.destinationAmount === undefined
        ? ""
        : String(form.entry.destinationAmount),
    category: form.entry.category ?? "",
    note: form.entry.note ?? "",
  };
}

function eligibleAccounts(
  accounts: LedgerEntryFormState["accounts"],
  type: LedgerEntryType,
) {
  return type === "fund_contribution" || type === "fund_withdrawal"
    ? accounts.filter((account) => account.type === "fund")
    : accounts;
}

function firstOtherAccountId(
  accounts: LedgerEntryFormState["accounts"],
  accountId: string,
) {
  return accounts.find((account) => account.id !== accountId)?.id ?? "";
}

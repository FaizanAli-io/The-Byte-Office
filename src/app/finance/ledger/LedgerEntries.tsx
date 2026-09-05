"use client";

import {
  accountMovement,
  ENTRY_LABELS,
  formatMoney,
  monthBounds,
} from "@/lib/ledger";
import type {
  LedgerAccount,
  LedgerEntry,
  LedgerEntryType,
} from "@/types/ledger";
import { useEffect, useMemo, useState } from "react";
import { FinanceCard, financeStyles } from "../components/FinanceUI";
import { Field } from "./LedgerAccounts";

export function LedgerEntries({
  month,
  accounts,
  entries,
  readOnly,
  onAdd,
  onUpdate,
  onRemove,
}: {
  month: string;
  accounts: LedgerAccount[];
  entries: LedgerEntry[];
  readOnly: boolean;
  onAdd: (entry: LedgerEntry) => void;
  onUpdate: (entry: LedgerEntry) => void;
  onRemove: (id: string) => void;
}) {
  const bounds = monthBounds(month);
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState(() => emptyDraft(bounds.min));
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setDraft(emptyDraft(bounds.min));
    setEditingId(null);
  }, [bounds.min]);

  const visibleEntries = useMemo(
    () =>
      [...entries]
        .filter(
          (entry) =>
            filter === "all" ||
            entry.accountId === filter ||
            entry.destinationAccountId === filter,
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [entries, filter],
  );
  const sourceAccount = accounts.find(
    (account) => account.id === draft.accountId,
  );
  const destinationAccount = accounts.find(
    (account) => account.id === draft.destinationAccountId,
  );
  const requiresDestinationAmount =
    draft.type === "transfer" &&
    sourceAccount &&
    destinationAccount &&
    sourceAccount.currency !== destinationAccount.currency;

  function addEntry() {
    const amount = Number(draft.amount);
    if (
      !draft.accountId ||
      !draft.date ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return;
    }
    const destinationAmount =
      draft.type === "transfer" && draft.destinationAmount
        ? Number(draft.destinationAmount)
        : undefined;
    const previous = entries.find((item) => item.id === editingId);
    const entry: LedgerEntry = {
      id: editingId ?? crypto.randomUUID(),
      date: draft.date,
      type: draft.type,
      accountId: draft.accountId,
      destinationAccountId:
        draft.type === "transfer" ? draft.destinationAccountId : undefined,
      amount,
      destinationAmount,
      exchangeRate:
        previous?.accountId === draft.accountId
          ? (previous.exchangeRate ?? sourceAccount?.exchangeRate ?? 1)
          : (sourceAccount?.exchangeRate ?? 1),
      category: draft.category.trim() || undefined,
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
    setEditingId(entry.id);
    setDraft({
      date: entry.date,
      type: entry.type,
      accountId: entry.accountId,
      destinationAccountId: entry.destinationAccountId ?? "",
      amount: String(entry.amount),
      destinationAmount:
        entry.destinationAmount === undefined
          ? ""
          : String(entry.destinationAmount),
      category: entry.category ?? "",
      note: entry.note ?? "",
    });
  }

  return (
    <FinanceCard
      title="Transactions"
      description="Transfers stay outside income and expense totals and update both accounts."
      action={
        <select
          aria-label="Filter transactions by account"
          className={`${financeStyles.input} min-w-44`}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      }
    >
      {!readOnly ? (
        <div
          className={`${financeStyles.inset} mb-6 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4`}
        >
          <Field label="Date">
            <input
              className={financeStyles.input}
              type="date"
              min={bounds.min}
              max={bounds.max}
              value={draft.date}
              onChange={(event) =>
                setDraft({ ...draft, date: event.target.value })
              }
            />
          </Field>
          <Field label="Type">
            <select
              className={financeStyles.input}
              value={draft.type}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  type: event.target.value as LedgerEntryType,
                })
              }
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
              onChange={(event) =>
                setDraft({ ...draft, accountId: event.target.value })
              }
            >
              <option value="">Select account</option>
              {eligibleAccounts(accounts, draft.type).map((account) => (
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
              onChange={(event) =>
                setDraft({ ...draft, amount: event.target.value })
              }
              placeholder="0"
            />
          </Field>
          {draft.type === "transfer" ? (
            <>
              <Field label="To account">
                <select
                  className={financeStyles.input}
                  value={draft.destinationAccountId}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      destinationAccountId: event.target.value,
                    })
                  }
                >
                  <option value="">Select destination</option>
                  {accounts
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
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      destinationAmount: event.target.value,
                    })
                  }
                  placeholder="For currency conversion"
                />
              </Field>
            </>
          ) : null}
          <Field label="Category (optional)">
            <input
              className={financeStyles.input}
              value={draft.category}
              onChange={(event) =>
                setDraft({ ...draft, category: event.target.value })
              }
              placeholder="Salary, bills, food…"
            />
          </Field>
          <Field label="Note (optional)">
            <input
              className={financeStyles.input}
              value={draft.note}
              onChange={(event) =>
                setDraft({ ...draft, note: event.target.value })
              }
              placeholder="Short description"
            />
          </Field>
          <button
            type="button"
            className={`${financeStyles.primary} self-end`}
            disabled={
              !draft.accountId ||
              !draft.amount ||
              (draft.type === "transfer" && !draft.destinationAccountId) ||
              (requiresDestinationAmount && !draft.destinationAmount)
            }
            onClick={addEntry}
          >
            {editingId ? "Update transaction" : "Add transaction"}
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

      <div className="space-y-3 md:hidden">
        {visibleEntries.map((entry, index) => {
          const account = accounts.find((item) => item.id === entry.accountId);
          const destination = accounts.find(
            (item) => item.id === entry.destinationAccountId,
          );
          const running =
            filter === "all"
              ? undefined
              : runningBalance(
                  filter,
                  visibleEntries.slice(0, index + 1),
                  accounts,
                );
          return (
            <article key={entry.id} className={`${financeStyles.inset} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">
                    {new Date(`${entry.date}T00:00:00`).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                  </p>
                  <p className="mt-2 font-bold text-slate-100">
                    {account?.name ?? "Unknown account"}
                  </p>
                  {destination ? (
                    <p className="mt-1 text-xs text-slate-500">
                      to {destination.name}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-right font-bold text-cyan-300">
                  {formatMoney(entry.amount, account?.currency ?? "PKR")}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-white/[0.05] px-2.5 py-1 font-semibold text-slate-300">
                  {ENTRY_LABELS[entry.type]}
                </span>
                {entry.category ? (
                  <span className="text-slate-400">{entry.category}</span>
                ) : null}
              </div>
              {entry.note ? (
                <p className="mt-3 break-words text-xs leading-5 text-slate-500">
                  {entry.note}
                </p>
              ) : null}
              {running !== undefined ? (
                <div className="mt-3 flex justify-between border-t border-white/6 pt-3 text-xs">
                  <span className="text-slate-500">Running balance</span>
                  <span className="font-bold text-cyan-300">
                    {formatMoney(
                      running,
                      accounts.find((item) => item.id === filter)?.currency ??
                        "PKR",
                    )}
                  </span>
                </div>
              ) : null}
              {!readOnly ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={financeStyles.secondary}
                    onClick={() => editEntry(entry)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={financeStyles.danger}
                    onClick={() => onRemove(entry.id)}
                  >
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
              <th className="border-b border-white/8 px-3 py-3 font-semibold">
                Date
              </th>
              <th className="border-b border-white/8 px-3 py-3 font-semibold">
                Type
              </th>
              <th className="border-b border-white/8 px-3 py-3 font-semibold">
                Account
              </th>
              <th className="border-b border-white/8 px-3 py-3 font-semibold">
                Details
              </th>
              <th className="border-b border-white/8 px-3 py-3 text-right font-semibold">
                Amount
              </th>
              <th className="border-b border-white/8 px-3 py-3 text-right font-semibold">
                {filter === "all" ? "" : "Running balance"}
              </th>
              <th className="border-b border-white/8 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry, index) => {
              const account = accounts.find(
                (item) => item.id === entry.accountId,
              );
              const destination = accounts.find(
                (item) => item.id === entry.destinationAccountId,
              );
              const running =
                filter === "all"
                  ? undefined
                  : runningBalance(
                      filter,
                      visibleEntries.slice(0, index + 1),
                      accounts,
                    );
              return (
                <tr key={entry.id} className="text-slate-300">
                  <td className="border-b border-white/5 px-3 py-4 text-slate-500">
                    {new Date(`${entry.date}T00:00:00`).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </td>
                  <td className="border-b border-white/5 px-3 py-4">
                    <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-semibold">
                      {ENTRY_LABELS[entry.type]}
                    </span>
                  </td>
                  <td className="border-b border-white/5 px-3 py-4">
                    {account?.name ?? "Unknown"}
                    {destination ? (
                      <span className="block text-xs text-slate-600">
                        to {destination.name}
                      </span>
                    ) : null}
                  </td>
                  <td className="border-b border-white/5 px-3 py-4">
                    <span>{entry.category || "—"}</span>
                    {entry.note ? (
                      <span className="block max-w-xs truncate text-xs text-slate-600">
                        {entry.note}
                      </span>
                    ) : null}
                  </td>
                  <td className="border-b border-white/5 px-3 py-4 text-right font-semibold">
                    {formatMoney(entry.amount, account?.currency ?? "PKR")}
                  </td>
                  <td className="border-b border-white/5 px-3 py-4 text-right font-semibold text-cyan-300">
                    {running === undefined
                      ? ""
                      : formatMoney(
                          running,
                          accounts.find((item) => item.id === filter)
                            ?.currency ?? "PKR",
                        )}
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
        <p className="py-10 text-center text-sm text-slate-600">
          No transactions for this view.
        </p>
      ) : null}
    </FinanceCard>
  );
}

function eligibleAccounts(accounts: LedgerAccount[], type: LedgerEntryType) {
  if (type === "fund_contribution" || type === "fund_withdrawal") {
    return accounts.filter((account) => account.type === "fund");
  }
  return accounts;
}

function runningBalance(
  accountId: string,
  entries: LedgerEntry[],
  accounts: LedgerAccount[],
) {
  const account = accounts.find((item) => item.id === accountId);
  if (!account) return 0;
  return entries.reduce(
    (balance, entry) => balance + accountMovement(accountId, entry),
    account.openingBalance,
  );
}

function emptyDraft(date: string) {
  return {
    date,
    type: "expense" as LedgerEntryType,
    accountId: "",
    destinationAccountId: "",
    amount: "",
    destinationAmount: "",
    category: "",
    note: "",
  };
}

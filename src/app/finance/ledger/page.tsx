"use client";

import { formatMoney, ledgerSummary } from "@/lib/ledger";
import {
  FinancePageShell,
  StatCard,
  financeStyles,
} from "../components/FinanceUI";
import { LedgerAccounts } from "./LedgerAccounts";
import { LedgerEntries } from "./LedgerEntries";
import { useLedger } from "./useLedger";

export default function LedgerPage() {
  const ledgerState = useLedger();

  const {
    month,
    setMonth,
    ledger,
    loading,
    saving,
    error,
    notice,
    create,
    save,
    updateAccount,
    addAccount,
    removeAccount,
    addEntry,
    updateEntry,
    removeEntry,
  } = ledgerState;
  const summary = ledger ? ledgerSummary(ledger) : null;
  const isFinalized = ledger?.status === "finalized";
  const canFinalize =
    Boolean(ledger?.accounts.length) &&
    ledger?.accounts.every(
      (account) => account.actualClosingBalance !== undefined,
    );

  return (
    <FinancePageShell
      title="Monthly ledger"
      description="Reconcile cash accounts and see mutual-fund cash flow and market performance without mixing the two."
      actions={
        <>
          <label>
            <span className="sr-only">Ledger month</span>
            <input
              type="month"
              className={`${financeStyles.input} min-w-44`}
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
          {ledger ? (
            isFinalized ? (
              <button
                type="button"
                className={financeStyles.secondary}
                disabled={saving}
                onClick={() => save("draft")}
              >
                Reopen month
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={financeStyles.secondary}
                  disabled={saving}
                  onClick={() => save("draft")}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className={financeStyles.primary}
                  disabled={saving || !canFinalize}
                  title={
                    canFinalize
                      ? undefined
                      : "Enter every actual closing balance first"
                  }
                  onClick={() => save("finalized")}
                >
                  Finalize month
                </button>
              </>
            )
          ) : null}
        </>
      }
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {loading ? (
        <div
          className={`${financeStyles.card} p-12 text-center text-slate-500`}
        >
          Loading ledger…
        </div>
      ) : !ledger ? (
        <div className={`${financeStyles.card} p-8 text-center sm:p-12`}>
          <p className="text-xl font-bold text-white">No ledger for {month}</p>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
            Create a blank month (which carries the latest finalized balances
            when available), or take a one-time copy from the portfolio editor.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              className={financeStyles.primary}
              disabled={saving}
              onClick={() => create(false)}
            >
              Create month
            </button>
            <button
              type="button"
              className={financeStyles.secondary}
              disabled={saving}
              onClick={() => create(true)}
            >
              Import portfolio balances
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-1 rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              Status:{" "}
              <span
                className={
                  isFinalized
                    ? "font-semibold text-emerald-300"
                    : "font-semibold text-amber-300"
                }
              >
                {isFinalized ? "Finalized" : "Draft"}
              </span>
            </p>
            <p className="text-xs text-slate-600">
              {isFinalized
                ? "Reopen to make changes"
                : "Changes save when you click Save"}
            </p>
          </div>

          {summary ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Income"
                value={formatMoney(summary.income, "PKR")}
                tone="emerald"
              />
              <StatCard
                label="Expenses"
                value={formatMoney(summary.expenses, "PKR")}
                tone="rose"
              />
              <StatCard
                label="Net cash flow"
                value={formatMoney(summary.netCashFlow, "PKR")}
                tone={summary.netCashFlow >= 0 ? "cyan" : "rose"}
              />
              <StatCard
                label="Fund cash flow"
                value={formatMoney(summary.fundFlow, "PKR")}
                hint="Contributions minus withdrawals"
                tone="amber"
              />
            </div>
          ) : null}

          <LedgerAccounts
            accounts={ledger.accounts}
            entries={ledger.entries}
            readOnly={isFinalized}
            onAdd={addAccount}
            onChange={updateAccount}
            onRemove={removeAccount}
          />
          <LedgerEntries
            month={ledger.month}
            accounts={ledger.accounts}
            entries={ledger.entries}
            readOnly={isFinalized}
            onAdd={addEntry}
            onUpdate={updateEntry}
            onRemove={removeEntry}
          />
        </div>
      )}
    </FinancePageShell>
  );
}

function Alert({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
        tone === "error"
          ? "border-rose-400/20 bg-rose-400/8 text-rose-200"
          : "border-emerald-400/20 bg-emerald-400/8 text-emerald-200"
      }`}
    >
      {children}
    </div>
  );
}

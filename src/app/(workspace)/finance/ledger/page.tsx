'use client';

import { categoryTotals, formatMoney, heldFunds, ledgerSummary } from '@/lib/ledger';
import type { ReactNode } from 'react';
import { FinancePageShell, StatCard, financeStyles, openPicker } from '../components/FinanceUI';
import { ExchangeRatesNote, useExchangeRates } from '../components/ExchangeRates';
import { useHeldFunds } from '../components/useLoad';
import { LedgerAccounts } from './LedgerAccounts';
import { LedgerCategories } from './LedgerCategories';
import { LedgerEntries } from './LedgerEntries';
import { useLedger } from './useLedger';

export default function LedgerPage() {
  const {
    month,
    setMonth,
    ledger,
    loading,
    saving,
    error,
    notice,
    create,
    refresh,
    save,
    saveAccounts,
    accountsDirty,
    updateAccount,
    addAccount,
    removeAccount,
    addEntry,
    updateEntry,
    removeEntry,
    categories,
    saveCategory,
    removeCategory,
  } = useLedger();
  const rates = useExchangeRates();
  const summary = ledger ? ledgerSummary(ledger) : null;
  // Held funds carried in from earlier months; this month's own movement comes live from the ledger.
  const { data: held } = useHeldFunds([month], Boolean(month));
  const heldBefore = held ? heldFunds(held.movements.filter((movement) => movement.month < month)).total : null;
  const heldOutstanding = summary && heldBefore !== null ? heldBefore + summary.heldMovement : 0;
  const showHeld = heldBefore !== null && Boolean(heldOutstanding || summary?.heldMovement);
  const isFinalized = ledger?.status === 'finalized';
  const canFinalize =
    Boolean(ledger?.accounts.length) && ledger?.accounts.every((account) => account.actualClosingBalance !== undefined);

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
              onClick={openPicker}
              className={`${financeStyles.input} min-w-44`}
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
          {ledger ? (
            isFinalized ? (
              <button type="button" className={financeStyles.secondary} disabled={saving} onClick={() => save('draft')}>
                Reopen month
              </button>
            ) : (
              <button
                type="button"
                className={financeStyles.primary}
                disabled={saving || !canFinalize}
                title={canFinalize ? undefined : 'Enter every actual closing balance first'}
                onClick={() => save('finalized')}
              >
                Finalize month
              </button>
            )
          ) : null}
        </>
      }
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {loading ? (
        <div className={`${financeStyles.card} p-12 text-center text-slate-500`}>Loading ledger…</div>
      ) : !ledger ? (
        <div className={`${financeStyles.card} p-8 text-center sm:p-12`}>
          <p className="text-xl font-bold text-white">No ledger for {month}</p>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
            The month opens with an account for every portfolio holding, at its current value, and stays in sync with
            the portfolio from then on.
          </p>
          <div className="mt-6 flex justify-center">
            <button type="button" className={financeStyles.primary} disabled={saving} onClick={create}>
              Create month
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-1 rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              Status:{' '}
              <span className={isFinalized ? 'font-semibold text-emerald-300' : 'font-semibold text-amber-300'}>
                {isFinalized ? 'Finalized' : 'Draft'}
              </span>
            </p>
            <p className="text-xs text-slate-600">
              {isFinalized
                ? 'Reopen to make changes'
                : 'Transactions save automatically. Account balances save when you click Save.'}
            </p>
          </div>
          {isFinalized ? null : (
            <ExchangeRatesNote rates={rates} currencies={ledger.accounts.map((account) => account.currency)} />
          )}

          {summary ? (
            <div className={`grid gap-4 sm:grid-cols-2 ${showHeld ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
              <StatCard label="Income" value={formatMoney(summary.income, 'PKR')} tone="emerald" />
              <StatCard label="Expenses" value={formatMoney(summary.expenses, 'PKR')} tone="rose" />
              <StatCard
                label="Net cash flow"
                value={formatMoney(summary.netCashFlow, 'PKR')}
                tone={summary.netCashFlow >= 0 ? 'cyan' : 'rose'}
              />
              <StatCard
                label="Fund cash flow"
                value={formatMoney(summary.fundFlow, 'PKR')}
                hint="Contributions minus withdrawals"
                tone="amber"
              />
              {showHeld ? (
                <StatCard
                  label="Held funds"
                  value={formatMoney(heldOutstanding, 'PKR')}
                  hint={`${summary.heldMovement > 0 ? '+' : ''}${formatMoney(summary.heldMovement, 'PKR')} this month`}
                />
              ) : null}
            </div>
          ) : null}

          <LedgerAccounts
            month={ledger.month}
            accounts={ledger.accounts}
            categories={categories}
            currencies={Object.keys(rates?.currencies ?? {}).sort()}
            entries={ledger.entries}
            readOnly={isFinalized}
            saving={saving}
            accountsDirty={accountsDirty}
            onAdd={addAccount}
            onChange={updateAccount}
            onRemove={removeAccount}
            onAddEntry={(entry) => {
              addEntry(entry);
              if (accountsDirty) void saveAccounts();
            }}
            onSave={saveAccounts}
          />
          <LedgerCategories
            categories={categories}
            totals={categoryTotals(ledger)}
            saving={saving}
            readOnly={isFinalized}
            onSave={saveCategory}
            onRemove={removeCategory}
          />
          <LedgerEntries
            month={ledger.month}
            accounts={ledger.accounts}
            categories={categories}
            entries={ledger.entries}
            readOnly={isFinalized}
            busy={saving}
            onRefresh={refresh}
            onAdd={addEntry}
            onUpdate={updateEntry}
            onRemove={removeEntry}
          />
        </div>
      )}
    </FinancePageShell>
  );
}

function Alert({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <div
      role="status"
      className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
        tone === 'error'
          ? 'border-rose-400/20 bg-rose-400/8 text-rose-200'
          : 'border-emerald-400/20 bg-emerald-400/8 text-emerald-200'
      }`}
    >
      {children}
    </div>
  );
}

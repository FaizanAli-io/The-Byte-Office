'use client';

import {
  accountStats,
  formatMoney,
  formatVariancePct,
  RECONCILIATION_CATEGORY,
  reconcileDate,
  variancePct,
} from '@/lib/ledger';
import type { LedgerAccount, LedgerCategory, LedgerEntry } from '@/types/ledger';
import { useState } from 'react';
import { FinanceCard, Field, financeStyles } from '../components/FinanceUI';

export function LedgerAccounts({
  month,
  accounts,
  categories,
  entries,
  readOnly,
  saving,
  accountsDirty,
  onAdd,
  onChange,
  onRemove,
  onAddEntry,
  onSave,
}: {
  month: string;
  accounts: LedgerAccount[];
  categories: LedgerCategory[];
  entries: LedgerEntry[];
  readOnly: boolean;
  saving: boolean;
  accountsDirty: boolean;
  onAdd: (account: LedgerAccount) => void;
  onChange: (id: string, patch: Partial<LedgerAccount>) => void;
  onRemove: (id: string) => void;
  onAddEntry: (entry: LedgerEntry) => void;
  onSave: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    type: 'bank' as LedgerAccount['type'],
    currency: 'PKR' as LedgerAccount['currency'],
  });

  function addAccount() {
    if (!draft.name.trim()) return;
    onAdd({
      id: crypto.randomUUID(),
      name: draft.name.trim(),
      type: draft.type,
      currency: draft.currency,
      openingBalance: 0,
      openingCostBasis: draft.type === 'fund' ? 0 : undefined,
      exchangeRate: draft.currency === 'USD' ? 280 : 1,
    });
    setDraft({ name: '', type: 'bank', currency: 'PKR' });
    setShowAdd(false);
  }

  function forceReconcile(account: LedgerAccount, difference: number) {
    onAddEntry({
      id: crypto.randomUUID(),
      date: reconcileDate(month),
      type: difference > 0 ? 'income' : 'expense',
      accountId: account.id,
      amount: Math.round(Math.abs(difference) * 100) / 100,
      exchangeRate: account.exchangeRate,
      categoryId: categories.find((category) => category.name === RECONCILIATION_CATEGORY)?.id,
      note: 'Force reconcile',
    });
  }

  return (
    <FinanceCard
      title="Accounts & opening balances"
      description="Kept in sync with your portfolio in both directions. Balances stay in each account's own currency."
      action={
        !readOnly ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={financeStyles.primary}
              disabled={saving || !accountsDirty}
              onClick={onSave}
            >
              {saving && accountsDirty ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className={financeStyles.secondary} onClick={() => setShowAdd((value) => !value)}>
              {showAdd ? 'Cancel' : 'Add account'}
            </button>
          </div>
        ) : null
      }
    >
      {showAdd ? (
        <div className={`${financeStyles.inset} mb-5 grid gap-3 p-4 md:grid-cols-[1fr_12rem_10rem_auto]`}>
          <Field label="Account name">
            <input
              autoFocus
              className={financeStyles.input}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="e.g. Main bank"
            />
          </Field>
          <Field label="Type">
            <select
              className={financeStyles.input}
              value={draft.type}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  type: event.target.value as LedgerAccount['type'],
                  currency: event.target.value === 'fund' ? 'PKR' : draft.currency,
                })
              }
            >
              <option value="bank">Bank account</option>
              <option value="fund">Mutual fund</option>
            </select>
          </Field>
          <Field label="Currency">
            <select
              className={financeStyles.input}
              disabled={draft.type === 'fund'}
              value={draft.currency}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  currency: event.target.value as LedgerAccount['currency'],
                })
              }
            >
              <option value="PKR">PKR</option>
              <option value="USD">USD</option>
            </select>
          </Field>
          <button type="button" onClick={addAccount} className={`${financeStyles.primary} self-end`}>
            Add
          </button>
        </div>
      ) : null}

      {accounts.length === 0 ? (
        <div className={`${financeStyles.inset} p-8 text-center text-sm text-slate-500`}>
          No accounts yet. Import the portfolio or add one manually.
        </div>
      ) : (
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
          {accounts.map((account) => {
            const stats = accountStats(account, entries);
            const { difference } = stats;
            const reconciled = difference !== undefined && Math.abs(difference) < 0.01;
            const canForceReconcile = !readOnly && account.type === 'bank' && difference !== undefined && !reconciled;
            return (
              <div key={account.id} className={`${financeStyles.inset} w-[min(34rem,85%)] shrink-0 snap-start p-5`}>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-100">{account.name}</h3>
                    <Badge>{account.type === 'fund' ? 'Fund' : account.currency}</Badge>
                  </div>
                  {!readOnly ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-400 hover:text-rose-300"
                      onClick={() => onRemove(account.id)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Opening balance">
                    <MoneyInput
                      value={account.openingBalance}
                      disabled={readOnly}
                      onChange={(openingBalance) => onChange(account.id, { openingBalance })}
                    />
                  </Field>
                  <Field label={account.type === 'fund' ? 'Expected book value' : 'Expected closing'}>
                    <MoneyInput value={stats.expected} disabled onChange={() => undefined} />
                  </Field>
                  <Field label={account.type === 'fund' ? 'Current market value' : 'Actual closing balance'}>
                    <MoneyInput
                      value={account.actualClosingBalance}
                      disabled={readOnly}
                      placeholder="Enter to reconcile"
                      onChange={(actualClosingBalance) => onChange(account.id, { actualClosingBalance })}
                    />
                  </Field>
                  {account.type === 'fund' ? (
                    <Field label="Opening cost basis" hint="Cash invested at month start, not the market value.">
                      <MoneyInput
                        value={account.openingCostBasis}
                        disabled={readOnly}
                        onChange={(openingCostBasis) => onChange(account.id, { openingCostBasis })}
                      />
                    </Field>
                  ) : null}
                  {account.currency === 'USD' ? (
                    <Field label="PKR per USD">
                      <MoneyInput
                        value={account.exchangeRate}
                        disabled={readOnly}
                        onChange={(exchangeRate) => onChange(account.id, { exchangeRate })}
                      />
                    </Field>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-white/6 pt-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="grid flex-1 grid-cols-2 gap-3 text-sm">
                    <Metric
                      label={account.type === 'fund' ? 'Net invested' : 'Difference'}
                      value={
                        account.type === 'fund'
                          ? formatMoney(stats.netInvested, account.currency)
                          : difference === undefined
                            ? 'Not reconciled'
                            : formatMoney(difference, account.currency)
                      }
                    />
                    <Metric
                      label={account.type === 'fund' ? 'Gain / loss' : 'Variance'}
                      value={
                        account.type === 'fund'
                          ? stats.gainLoss === undefined
                            ? 'Add current value'
                            : formatMoney(stats.gainLoss, account.currency)
                          : formatVariancePct(variancePct(difference, stats.expected))
                      }
                      positive={account.type === 'fund' ? (stats.gainLoss ?? 0) >= 0 : reconciled}
                    />
                  </div>
                  {account.type === 'bank' && !readOnly ? (
                    <button
                      type="button"
                      className={financeStyles.secondary}
                      disabled={!canForceReconcile}
                      title={
                        canForceReconcile
                          ? 'Add a transaction so expected closing matches the actual'
                          : 'Enter an actual closing that differs from expected'
                      }
                      onClick={() => difference !== undefined && forceReconcile(account, difference)}
                    >
                      Force reconcile
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </FinanceCard>
  );
}

function MoneyInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value?: number;
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      className={financeStyles.input}
      type="number"
      min="0"
      disabled={disabled}
      step="0.01"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
    />
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-cyan-300/12 bg-cyan-300/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
      {children}
    </span>
  );
}

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-600">{label}</p>
      <p className={`mt-1 font-semibold ${positive ? 'text-emerald-300' : 'text-slate-300'}`}>{value}</p>
    </div>
  );
}

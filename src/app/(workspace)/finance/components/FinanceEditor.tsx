'use client';

import { heldFundsApi, snapshotsApi } from '@/lib/api-client';
import { portfolioTotals } from '@/lib/finance';
import { formatMoney, type heldFunds } from '@/lib/ledger';
import { useEffect, useState } from 'react';
import { BankSection, MutualFundsSection } from './HoldingTypes';
import { FinancePageShell, StatCard, financeStyles } from './FinanceUI';
import { FinanceToast, type FinanceToastState } from './FinanceToast';
import { useFinanceHandlers } from './useFinanceHandlers';

const DESCRIPTION =
  "The latest value of each account and fund, kept in sync with the newest ledger month: changing a value here records it as that account's closing balance.";

export default function FinanceEditor() {
  const { holdings, error, saving, loading, handleSave, add, remove, change, renameBank, removeBank } =
    useFinanceHandlers();
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [toast, setToast] = useState<FinanceToastState>(null);
  const [held, setHeld] = useState<ReturnType<typeof heldFunds> | null>(null);

  useEffect(() => {
    heldFundsApi
      .load()
      .then(setHeld)
      .catch((err) => console.error('Failed to fetch /api/held-funds:', err));
  }, []);

  async function handleSnapshot() {
    if (!holdings) return;
    setSnapshotLoading(true);
    try {
      await snapshotsApi.create(holdings, portfolioTotals(holdings).grandTotal);
      setToast({ message: 'Snapshot saved.', tone: 'success' });
    } catch (error) {
      console.error('Error saving snapshot:', error);
      setToast({ message: 'Failed to save snapshot.', tone: 'error' });
    } finally {
      setSnapshotLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Loading portfolio…</p>
      </div>
    );
  }

  if (!holdings) {
    return (
      <FinancePageShell title="Portfolio editor" description={DESCRIPTION}>
        <div className={`${financeStyles.card} p-12 text-center`}>
          <p className="font-bold text-white">Could not load portfolio</p>
          <p className="mt-2 text-sm text-slate-500">{error || 'No finance data found.'}</p>
        </div>
      </FinancePageShell>
    );
  }

  const totals = portfolioTotals(holdings, held?.total ?? 0);
  const indexed = holdings.map((holding, index) => ({ ...holding, index }));
  const holdingForOthers = Math.abs(totals.held) >= 0.005;

  return (
    <FinancePageShell
      title="Portfolio editor"
      description={DESCRIPTION}
      actions={
        <>
          <button type="button" onClick={handleSnapshot} disabled={snapshotLoading} className={financeStyles.secondary}>
            {snapshotLoading ? 'Saving snapshot…' : 'Take snapshot'}
          </button>
          <button
            type="button"
            onClick={async () => setToast(await handleSave())}
            disabled={saving}
            className={financeStyles.primary}
          >
            {saving ? 'Saving…' : 'Save portfolio'}
          </button>
        </>
      }
    >
      <div className={`mb-6 grid gap-4 sm:grid-cols-2 ${holdingForOthers ? 'xl:grid-cols-3' : 'xl:grid-cols-4'}`}>
        <StatCard label="Local banks" value={formatMoney(totals.local, 'PKR')} />
        <StatCard label="Remote banks" value={formatMoney(totals.remote, 'PKR')} />
        <StatCard label="Mutual funds" value={formatMoney(totals.mutual, 'PKR')} tone="amber" />
        <StatCard
          label="Portfolio total"
          value={formatMoney(totals.grandTotal, 'PKR')}
          hint={holdingForOthers ? 'Everything the accounts hold' : undefined}
          tone={holdingForOthers ? 'cyan' : 'emerald'}
        />
        {holdingForOthers ? (
          <>
            <StatCard
              label="Held for others"
              value={formatMoney(totals.held, 'PKR')}
              hint={held?.byCounterparty.map((row) => row.counterparty).join(', ')}
              tone="rose"
            />
            <StatCard
              label="Net worth"
              value={formatMoney(totals.net, 'PKR')}
              hint="Portfolio total minus held funds"
              tone="emerald"
            />
          </>
        ) : null}
      </div>

      <div className="space-y-6">
        <BankSection kind="local_bank" holdings={indexed} onAdd={add} onChange={change} onDelete={remove} />
        <BankSection kind="remote_bank" holdings={indexed} onAdd={add} onChange={change} onDelete={remove} />
        <MutualFundsSection
          holdings={indexed}
          onAdd={add}
          onChange={change}
          onDelete={remove}
          onRenameBank={renameBank}
          onDeleteBank={removeBank}
        />
      </div>
      <FinanceToast toast={toast} onDismiss={() => setToast(null)} />
    </FinancePageShell>
  );
}

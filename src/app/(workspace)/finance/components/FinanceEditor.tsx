'use client';

import { apiFetch } from '@/lib/client-api';
import { portfolioTotals } from '@/lib/finance';
import type { heldFunds } from '@/lib/ledger';
import { useEffect, useState } from 'react';
import { LocalBanksSection, MutualFundsSection, RemoteBanksSection } from './HoldingTypes';
import { FinancePageShell, StatCard, financeStyles } from './FinanceUI';
import { FinanceToast, type FinanceToastState } from './FinanceToast';
import { useFinanceHandlers } from './useFinanceHandlers';

export default function FinanceEditor() {
  const {
    data,
    error,
    saving,
    loading,
    handleChange,
    addMutualFundBank,
    deleteMutualFundBank,
    handleChangeMutualFund,
    addFundToBank,
    addRemoteBank,
    addLocalBank,
    deleteFundFromBank,
    deleteRemoteBank,
    deleteLocalBank,
    handleSave,
  } = useFinanceHandlers();
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [toast, setToast] = useState<FinanceToastState>(null);
  const [held, setHeld] = useState<ReturnType<typeof heldFunds> | null>(null);

  // Held funds come from the ledger rather than from the portfolio, so they
  // are a second read. A failure here only costs the net line, and the gross
  // figures are still correct without it, so it does not block the page.
  useEffect(() => {
    apiFetch<ReturnType<typeof heldFunds>>('/api/held-funds')
      .then(setHeld)
      .catch((err) => console.error('Failed to fetch /api/held-funds:', err));
  }, []);

  async function handleSnapshot() {
    if (!data) return;
    setSnapshotLoading(true);
    try {
      await apiFetch('/api/snapshots', { body: { data, grandTotal: portfolioTotals(data).grandTotal } });
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

  if (!data) {
    return (
      <FinancePageShell
        title="Portfolio editor"
        description="Keep the latest value of each account and fund. Use snapshots for history and the ledger for monthly reconciliation."
      >
        <div className={`${financeStyles.card} p-12 text-center`}>
          <p className="font-bold text-white">Could not load portfolio</p>
          <p className="mt-2 text-sm text-slate-500">{error || 'No finance data found.'}</p>
        </div>
      </FinancePageShell>
    );
  }

  // The snapshot keeps recording the gross total: it is a record of what the
  // accounts held, and what is owed back is derivable from the ledger for any
  // past date anyway.
  const totals = portfolioTotals(data, held?.total ?? 0);
  const holdingForOthers = Math.abs(totals.held) >= 0.005;

  return (
    <FinancePageShell
      title="Portfolio editor"
      description="Keep the latest value of each account and fund. Use snapshots for history and the ledger for monthly reconciliation."
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
        <StatCard label="Local banks" value={`${Math.round(totals.local).toLocaleString()} PKR`} />
        <StatCard label="Remote banks" value={`${Math.round(totals.remote).toLocaleString()} PKR`} />
        <StatCard label="Mutual funds" value={`${Math.round(totals.mutual).toLocaleString()} PKR`} tone="amber" />
        <StatCard
          label="Portfolio total"
          value={`${Math.round(totals.grandTotal).toLocaleString()} PKR`}
          hint={holdingForOthers ? 'Everything the accounts hold' : undefined}
          tone={holdingForOthers ? 'cyan' : 'emerald'}
        />
        {/* Two totals, because neither alone is honest: the accounts really do
            hold the gross figure, but only the net figure is yours. */}
        {holdingForOthers ? (
          <>
            <StatCard
              label="Held for others"
              value={`${Math.round(totals.held).toLocaleString()} PKR`}
              hint={held?.byCounterparty.map((row) => row.counterparty).join(', ')}
              tone="rose"
            />
            <StatCard
              label="Net worth"
              value={`${Math.round(totals.net).toLocaleString()} PKR`}
              hint="Portfolio total minus held funds"
              tone="emerald"
            />
          </>
        ) : null}
      </div>

      <div className="space-y-6">
        <LocalBanksSection data={data} onAdd={addLocalBank} onChange={handleChange} onDelete={deleteLocalBank} />
        <RemoteBanksSection data={data} onAdd={addRemoteBank} onChange={handleChange} onDelete={deleteRemoteBank} />
        <MutualFundsSection
          data={data}
          onAddFund={addFundToBank}
          onAddBank={addMutualFundBank}
          onChange={handleChangeMutualFund}
          onDeleteFund={deleteFundFromBank}
          onDeleteBank={deleteMutualFundBank}
        />
      </div>
      <FinanceToast toast={toast} onDismiss={() => setToast(null)} />
    </FinancePageShell>
  );
}

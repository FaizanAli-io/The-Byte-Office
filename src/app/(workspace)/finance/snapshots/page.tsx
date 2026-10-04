'use client';

import { snapshotsApi } from '@/lib/api-client';
import { errorMessage } from '@/lib/client-api';
import { bankFundAllocations, individualFundAllocations, portfolioAllocations } from '@/lib/finance';
import { formatMoney } from '@/lib/ledger';
import type { FinanceSnapshot } from '@/types/finance';
import { useEffect, useState } from 'react';
import { FinancePageShell, financeStyles } from '../components/FinanceUI';
import { FinanceToast, type FinanceToastState } from '../components/FinanceToast';
import { AllocationChart, SnapshotDiff, SnapshotTrend, TextSummary, formatSnapshotTime } from './components';

export default function SnapshotsPage() {
  const [snapshots, setSnapshots] = useState<FinanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  // Up to two snapshots to compare; picking a third drops the earliest pick.
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<FinanceToastState>(null);

  useEffect(() => {
    snapshotsApi
      .list()
      .then((loaded) => {
        setSnapshots(loaded);
        setError('');
      })
      .catch((cause) => {
        console.error('Error fetching snapshots:', cause);
        setError(errorMessage(cause, 'Could not load snapshots'));
      })
      .finally(() => setLoading(false));
  }, []);

  async function deleteSnapshot(id: string) {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      setToast({
        message: 'Click “Confirm delete” to remove this snapshot.',
        tone: 'info',
      });
      return;
    }

    try {
      await snapshotsApi.remove(id);
    } catch {
      setPendingDelete(null);
      setToast({ message: 'Failed to delete snapshot.', tone: 'error' });
      return;
    }
    setSnapshots((items) => items.filter((snapshot) => snapshot._id !== id));
    setExpanded((items) => items.filter((item) => item !== id));
    setSelected((items) => items.filter((item) => item !== id));
    setPendingDelete(null);
    setToast({ message: 'Snapshot deleted.', tone: 'success' });
  }

  function toggleSelected(id: string) {
    setSelected((items) => (items.includes(id) ? items.filter((item) => item !== id) : [...items, id].slice(-2)));
  }

  const pair = selected
    .map((id) => snapshots.find((snapshot) => snapshot._id === id))
    .filter(Boolean) as FinanceSnapshot[];

  return (
    <FinancePageShell
      title="Portfolio snapshots"
      description="A point-in-time history of total holdings and allocation across cash accounts and mutual funds."
    >
      {loading ? (
        <div className={`${financeStyles.card} p-12 text-center text-slate-500`}>Loading snapshots…</div>
      ) : error ? (
        <div className={`${financeStyles.card} p-12 text-center`}>
          <p className="font-bold text-white">Could not load snapshots</p>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
        </div>
      ) : snapshots.length === 0 ? (
        <div className={`${financeStyles.card} p-12 text-center`}>
          <p className="font-bold text-white">No snapshots yet</p>
          <p className="mt-2 text-sm text-slate-500">Take the first one from the portfolio editor.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {snapshots.length > 1 ? <SnapshotTrend snapshots={snapshots} /> : null}
          {pair.length === 2 ? (
            <SnapshotDiff pair={[pair[0], pair[1]]} onClear={() => setSelected([])} />
          ) : snapshots.length > 1 ? (
            <p className="text-sm text-slate-500">
              {pair.length === 1
                ? 'Select one more snapshot to compare.'
                : 'Tick Compare on any two snapshots to see what moved.'}
            </p>
          ) : null}
          {snapshots.map((snapshot) => {
            const id = String(snapshot._id);
            const isExpanded = expanded.includes(id);
            return (
              <article key={id} className={`${financeStyles.card} overflow-hidden`}>
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <button
                    type="button"
                    className="flex-1 text-left"
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setExpanded((items) => (isExpanded ? items.filter((item) => item !== id) : [...items, id]))
                    }
                  >
                    <p className="text-sm font-semibold text-slate-400">{formatSnapshotTime(snapshot.timestamp)}</p>
                    <p className="mt-2 text-2xl font-bold text-cyan-300">{formatMoney(snapshot.grandTotal, 'PKR')}</p>
                  </button>
                  <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-400">
                      <input
                        type="checkbox"
                        className="size-4 accent-cyan-300"
                        checked={selected.includes(id)}
                        onChange={() => toggleSelected(id)}
                      />
                      Compare
                    </label>
                    <span className="text-xs font-semibold text-slate-600">
                      {isExpanded ? 'Hide details' : 'View details'}
                    </span>
                    <button type="button" className={financeStyles.danger} onClick={() => deleteSnapshot(id)}>
                      {pendingDelete === id ? 'Confirm delete' : 'Delete'}
                    </button>
                  </div>
                </div>
                {isExpanded ? (
                  <div className="space-y-4 border-t border-white/7 p-5 sm:p-6">
                    <TextSummary snapshot={snapshot} />
                    <div className="grid gap-4 xl:grid-cols-3">
                      <AllocationChart title="Portfolio allocation" data={portfolioAllocations(snapshot.data)} />
                      <AllocationChart title="Funds by institution" data={bankFundAllocations(snapshot.data)} />
                      <AllocationChart title="Individual funds" data={individualFundAllocations(snapshot.data)} />
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      <FinanceToast toast={toast} onDismiss={() => setToast(null)} />
    </FinancePageShell>
  );
}

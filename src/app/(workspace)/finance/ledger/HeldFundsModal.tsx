'use client';

import { useEffect, useState } from 'react';
import { heldFundsApi } from '@/lib/api-client';
import { errorMessage } from '@/lib/client-api';
import { formatMoney, type heldFunds } from '@/lib/ledger';
import { Modal } from '../components/Modal';

/**
 * What is currently being held for other people, by counterparty.
 *
 * Holds outlive the month they were taken in, so this cannot be read off the
 * ledger on screen — it asks `/api/held-funds`, which folds every hold entry
 * ever written. It refetches on each open rather than caching, because adding
 * a hold entry behind it is exactly what someone does before looking.
 *
 * Only outstanding counterparties appear. One paid back in full nets to zero
 * and drops out; the entries that settled them are still in the ledger.
 */

type HeldFunds = ReturnType<typeof heldFunds>;

export function HeldFundsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [held, setHeld] = useState<HeldFunds | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    heldFundsApi
      .load()
      .then((data) => !cancelled && setHeld(data))
      .catch((cause) => !cancelled && setError(errorMessage(cause, 'Could not load held funds')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Held funds"
      description="Money sitting in your accounts that belongs to someone else, across every month."
    >
      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-rose-300">{error}</p>
      ) : !held?.byCounterparty.length ? (
        <p className="py-8 text-center text-sm text-slate-600">You are not holding anything for anyone.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.12em] text-slate-600">
                <th className="border-b border-white/8 px-3 py-3 font-semibold">Counterparty</th>
                <th className="border-b border-white/8 px-3 py-3 text-right font-semibold">Received</th>
                <th className="border-b border-white/8 px-3 py-3 text-right font-semibold">Returned</th>
                <th className="border-b border-white/8 px-3 py-3 text-right font-semibold">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {held.byCounterparty.map((row) => (
                <tr key={row.counterparty}>
                  <td className="border-b border-white/5 px-3 py-3 font-semibold text-slate-100">{row.counterparty}</td>
                  <td className="border-b border-white/5 px-3 py-3 text-right text-slate-400">
                    {formatMoney(row.received, 'PKR')}
                  </td>
                  <td className="border-b border-white/5 px-3 py-3 text-right text-slate-400">
                    {row.returned ? formatMoney(row.returned, 'PKR') : '—'}
                  </td>
                  {/* Negative means more went back than ever came in, which is
                      a mistake worth seeing rather than hiding. */}
                  <td
                    className={`border-b border-white/5 px-3 py-3 text-right font-bold ${
                      row.amount < 0 ? 'text-rose-300' : 'text-cyan-300'
                    }`}
                  >
                    {formatMoney(row.amount, 'PKR')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total</td>
                <td />
                <td />
                <td className="px-3 py-3 text-right text-base font-bold text-cyan-300">
                  {formatMoney(held.total, 'PKR')}
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-4 text-xs leading-5 text-slate-600">
            Converted to PKR at each entry&rsquo;s rate. This total is what the portfolio subtracts from your gross
            balance to reach net worth.
          </p>
        </div>
      )}
    </Modal>
  );
}

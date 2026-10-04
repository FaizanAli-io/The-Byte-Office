'use client';

import { snapshotDiff } from '@/lib/finance';
import { formatMoney } from '@/lib/ledger';
import type { FinanceSnapshot } from '@/types/finance';
import { financeStyles } from '../../components/FinanceUI';

export function formatSnapshotTime(timestamp: FinanceSnapshot['timestamp']) {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const money = (value: number | null) => (value === null ? '—' : formatMoney(value, 'PKR'));

function Delta({ value }: { value: number }) {
  const tone = value > 0 ? 'text-emerald-300' : value < 0 ? 'text-rose-300' : 'text-slate-500';
  return <span className={`font-bold ${tone}`}>{`${value > 0 ? '+' : ''}${formatMoney(value, 'PKR')}`}</span>;
}

export function SnapshotDiff({ pair, onClear }: { pair: [FinanceSnapshot, FinanceSnapshot]; onClear: () => void }) {
  const [older, newer] = [...pair].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
  const { classes, lines } = snapshotDiff(older.data.holdings, newer.data.holdings);

  return (
    <section className={`${financeStyles.card} space-y-4 p-5 sm:p-6`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-white">Comparison</h3>
          <p className="mt-1 text-sm text-slate-500">
            {formatSnapshotTime(older.timestamp)} → {formatSnapshotTime(newer.timestamp)}
          </p>
        </div>
        <button type="button" className={financeStyles.secondary} onClick={onClear}>
          Clear
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {classes.map((row) => (
          <div key={row.name} className={`${financeStyles.inset} p-4`}>
            <p className="text-xs font-semibold text-slate-500">{row.name}</p>
            <p className="mt-2 text-lg">
              <Delta value={row.delta} />
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {money(row.before)} → {money(row.after)}
            </p>
          </div>
        ))}
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-slate-500">No holdings changed.</p>
      ) : (
        <div className={`${financeStyles.inset} overflow-x-auto`}>
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                {['Holding', 'Class', 'Before', 'After', 'Change'].map((label, index) => (
                  <th
                    key={label}
                    className={`px-4 py-3 font-semibold ${index > 1 ? 'text-right' : ''} ${index === 1 ? 'max-sm:hidden' : ''}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-slate-300">
              {lines.map((line) => (
                <tr key={`${line.kind}-${line.name}`}>
                  <td className="px-4 py-2.5">
                    {line.name || 'Unnamed'}
                    {line.before === null || line.after === null ? (
                      <span className="ml-2 text-slate-500">{line.before === null ? 'new' : 'removed'}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 max-sm:hidden">{line.kind}</td>
                  <td className="px-4 py-2.5 text-right">{money(line.before)}</td>
                  <td className="px-4 py-2.5 text-right">{money(line.after)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Delta value={line.delta} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-600">Holdings match by name, so a renamed account shows as removed and new.</p>
    </section>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { snapshotSeries } from '@/lib/finance';
import { formatMoney } from '@/lib/ledger';
import type { FinanceSnapshot } from '@/types/finance';
import { financeStyles } from '../../components/FinanceUI';

const GROUPS = ['Totals', 'Bank accounts', 'Fund institutions', 'Funds'];
const TOTAL = 'Totals\u0000Total';
const LINE = '#67e8f9';
const INK = '#64748b';

const shortDate = (time: number) => new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const longDate = (time: number) =>
  new Date(time).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const compact = (value: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

/**
 * One series at a time over every snapshot, from the whole portfolio down to a
 * single fund. A holding absent from a snapshot counts as zero there: it was
 * not held, which is what the line should show.
 */
export function SnapshotTrend({ snapshots }: { snapshots: FinanceSnapshot[] }) {
  const [open, setOpen] = useState(true);
  const [key, setKey] = useState(TOTAL);

  const { points, options } = useMemo(() => {
    const ordered = [...snapshots].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
    const series = ordered.map((snapshot) => ({
      time: +new Date(snapshot.timestamp),
      values: snapshotSeries(snapshot.data),
    }));
    const options = new Map<string, { kind: string; name: string }>();
    series.forEach(({ values }) => values.forEach((value, id) => options.set(id, value)));
    return { points: series, options };
  }, [snapshots]);

  // A deleted snapshot can take the picked holding with it; fall back to the total.
  const activeKey = options.has(key) ? key : TOTAL;
  const selected = options.get(activeKey)!;
  const data = points.map(({ time, values }) => ({ time, value: values.get(activeKey)?.value ?? 0 }));
  const [first, last] = [data[0].value, data[data.length - 1].value];
  const delta = last - first;

  return (
    <section className={`${financeStyles.card} overflow-hidden`}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <div>
          <h3 className="font-bold text-white">Balance over time</h3>
          <p className="mt-1 text-sm text-slate-500">
            {selected.name} · {formatMoney(last, 'PKR')}{' '}
            <span className={delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : ''}>
              ({delta > 0 ? '+' : ''}
              {formatMoney(delta, 'PKR')} since{' '}
              {new Date(data[0].time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
            </span>
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-slate-600">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-white/7 p-5 sm:p-6">
          <label className="block max-w-sm">
            <span className={financeStyles.label}>Show</span>
            <select className={financeStyles.input} value={activeKey} onChange={(event) => setKey(event.target.value)}>
              {GROUPS.map((group) => {
                const entries = [...options].filter(([, option]) => option.kind === group);
                return entries.length ? (
                  <optgroup key={group} label={group}>
                    {entries.map(([id, option]) => (
                      <option key={id} value={id}>
                        {option.name || 'Unnamed'}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </select>
          </label>

          <div className="h-64 w-full sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="time"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={shortDate}
                  tick={{ fill: INK, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tickFormatter={compact}
                  tick={{ fill: INK, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  cursor={{ stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1 }}
                  labelFormatter={(time) => longDate(Number(time))}
                  formatter={(value) => [formatMoney(Number(value), 'PKR'), selected.name]}
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                  }}
                  itemStyle={{ color: '#f1f5f9', fontWeight: 700 }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Line
                  type="linear"
                  dataKey="value"
                  stroke={LINE}
                  strokeWidth={2}
                  dot={{ r: 4, fill: LINE, stroke: '#0f172a', strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: LINE, stroke: '#0f172a', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </section>
  );
}

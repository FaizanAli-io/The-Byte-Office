'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  distinctMetrics,
  formatReading,
  readingsFor,
  trendSummary,
  weeklyAverages,
  type TrendPoint,
} from '@/lib/health';
import type { HealthTracking } from '@/types/personal';
import { FinanceCard, Field, chartTooltip, deltaTone, financeStyles, signed } from '../components/FinanceUI';

const RANGES = [
  { key: '30', label: '30d', days: 30 },
  { key: '90', label: '90d', days: 90 },
  { key: '365', label: '1y', days: 365 },
  { key: 'all', label: 'All', days: null },
] as const;

type RangeKey = (typeof RANGES)[number]['key'];

const ENOUGH_TO_SMOOTH = 12;

const A_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function HealthChart({ entries }: { entries: HealthTracking[] }) {
  const metrics = useMemo(() => distinctMetrics(entries), [entries]);
  const [metric, setMetric] = useState(() => entries[0]?.metric ?? '');
  const [range, setRange] = useState<RangeKey>('90');
  const [weekly, setWeekly] = useState(false);

  const selected = metrics.includes(metric) ? metric : (metrics[0] ?? '');
  const days = RANGES.find((option) => option.key === range)?.days ?? null;

  const readings = useMemo(() => readingsFor(entries, selected, days), [entries, selected, days]);
  const smoothable = readings.length >= ENOUGH_TO_SMOOTH;
  const points: TrendPoint[] = useMemo(
    () => (weekly && smoothable ? weeklyAverages(readings) : readings.map((point) => ({ ...point, readings: 1 }))),
    [readings, weekly, smoothable]
  );
  const summary = trendSummary(readings);

  if (!entries.length) return null;

  return (
    <FinanceCard title="Trend" description="One metric at a time — readings in different units do not share an axis.">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Field label="Metric" className="min-w-44 flex-1">
          <select className={financeStyles.input} value={selected} onChange={(event) => setMetric(event.target.value)}>
            {metrics.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <ButtonGroup
          label="Range"
          options={RANGES.map((option) => ({ key: option.key, label: option.label }))}
          value={range}
          onChange={(key) => setRange(key as RangeKey)}
        />
        {smoothable ? (
          <ButtonGroup
            label="Points"
            options={[
              { key: 'raw', label: 'Every reading' },
              { key: 'weekly', label: 'Weekly average' },
            ]}
            value={weekly ? 'weekly' : 'raw'}
            onChange={(key) => setWeekly(key === 'weekly')}
          />
        ) : null}
      </div>

      {points.length < 2 || !summary ? (
        <div className="flex h-64 items-center justify-center text-center text-sm text-slate-600">
          {points.length ? 'One reading in this window — a trend needs at least two.' : 'No readings in this window.'}
        </div>
      ) : (
        <>
          <div className="h-64 w-full sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="#ffffff" strokeOpacity={0.06} vertical={false} />
                <XAxis
                  dataKey="at"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(at: number) => formatAxisDate(at, summary.spanMs > A_YEAR_MS)}
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <Tooltip
                  labelFormatter={(at) => new Date(Number(at)).toLocaleDateString()}
                  formatter={(value, _name, item) => {
                    const count = (item?.payload as TrendPoint | undefined)?.readings ?? 1;
                    return [formatReading(Number(value)), count > 1 ? `${selected} (${count} readings)` : selected];
                  }}
                  {...chartTooltip}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#67e8f9"
                  strokeWidth={2}
                  dot={points.length <= 60 ? { r: 2.5, fill: '#67e8f9', stroke: 'none' } : false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid gap-3 border-t border-white/6 pt-4 sm:grid-cols-3">
            <Figure label="Latest" value={formatReading(summary.latest)} />
            <Figure
              label="Change"
              value={signed(summary.change, formatReading(summary.change))}
              tone={deltaTone(summary.change, 'text-slate-300')}
            />
            <Figure label="Average" value={formatReading(summary.average)} />
          </div>
        </>
      )}
    </FinanceCard>
  );
}

function Figure({ label, value, tone = 'text-slate-200' }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function ButtonGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div>
      <span className={financeStyles.label}>{label}</span>
      <div className="flex gap-1 rounded-lg border border-white/8 bg-white/[0.025] p-1">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={value === option.key}
            onClick={() => onChange(option.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              value === option.key ? 'bg-cyan-400/15 text-cyan-200' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatAxisDate(at: number, spansAYear: boolean) {
  return new Date(at).toLocaleDateString(
    'en-US',
    spansAYear ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' }
  );
}

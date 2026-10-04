'use client';

import { useState } from 'react';
import { healthMetricsApi } from '@/lib/api-client';
import { errorMessage } from '@/lib/client-api';
import type { HealthMetric } from '@/types/personal';
import { FinanceCard, financeStyles } from '../components/FinanceUI';
import type { FinanceToastState } from '../components/FinanceToast';

export function HealthMetrics({
  metrics,
  onChange,
  onToast,
}: {
  metrics: HealthMetric[];
  onChange: () => Promise<void>;
  onToast: (toast: FinanceToastState) => void;
}) {
  const [name, setName] = useState('');

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      await onChange();
      onToast({ tone: 'success', message: success });
    } catch (cause) {
      onToast({ tone: 'error', message: errorMessage(cause, 'Could not save the metric') });
    }
  }

  function rename(metric: HealthMetric) {
    const next = window.prompt(`Rename "${metric.name}"`, metric.name)?.trim();
    if (next && next !== metric.name) void run(() => healthMetricsApi.rename(metric.id, next), 'Metric renamed.');
  }

  return (
    <FinanceCard title="Metrics" description="Readings pick from this list, so one measurement keeps one name.">
      <div className={`${financeStyles.inset} mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end`}>
        <label className="flex-1">
          <span className={financeStyles.label}>New metric</span>
          <input
            className={financeStyles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Weight (KG)"
          />
        </label>
        <button
          type="button"
          className={financeStyles.primary}
          disabled={!name.trim()}
          onClick={() => void run(() => healthMetricsApi.create(name.trim()), 'Metric added.').then(() => setName(''))}
        >
          Add metric
        </button>
      </div>
      <div className="space-y-2">
        {metrics.map((metric) => (
          <div key={metric.id} className={`${financeStyles.inset} flex items-center justify-between gap-3 px-4 py-2`}>
            <p className="text-sm text-white">
              {metric.name} <span className="text-xs text-slate-500">· {metric.readingCount} readings</span>
            </p>
            <div className="flex gap-2">
              <button type="button" className={financeStyles.secondary} onClick={() => rename(metric)}>
                Rename
              </button>
              <button
                type="button"
                className={financeStyles.danger}
                disabled={metric.readingCount > 0}
                title={metric.readingCount ? 'Readings use this metric' : undefined}
                onClick={() => void run(() => healthMetricsApi.remove(metric.id), 'Metric deleted.')}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </FinanceCard>
  );
}

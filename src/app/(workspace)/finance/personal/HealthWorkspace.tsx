'use client';

import { healthApi, healthMetricsApi } from '@/lib/api-client';
import { errorMessage } from '@/lib/client-api';
import type { HealthMetric, HealthTracking } from '@/types/personal';
import { useCallback, useState } from 'react';
import { FinanceCard, Field, StatCard, financeStyles, openPicker } from '../components/FinanceUI';
import { HealthChart } from './HealthChart';
import { HealthMetrics } from './HealthMetrics';
import { PersonalShell, usePersonalData } from './PersonalShell';

const EMPTY_FORM = { metric: '', value: '', createdAt: '' };

export function HealthWorkspace() {
  const [health, setHealth] = useState<HealthTracking[]>([]);
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [readings, metricList] = await Promise.all([healthApi.list(), healthMetricsApi.list()]);
    setHealth(readings);
    setMetrics(metricList);
  }, []);
  const shell = usePersonalData(refresh);
  const { setToast } = shell;
  const latest = health[0];

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function submit() {
    const value = Number(form.value);
    if (!form.metric || !Number.isFinite(value) || !form.value.trim()) {
      setToast({ tone: 'error', message: 'Choose a metric and enter a numeric value.' });
      return;
    }
    setSaving(true);
    try {
      const payload = { metricId: form.metric, value, ...(form.createdAt ? { createdAt: form.createdAt } : {}) };
      await (editingId ? healthApi.update(editingId, payload) : healthApi.create(payload));
      resetForm();
      await refresh();
      setToast({ tone: 'success', message: editingId ? 'Health entry updated.' : 'Health entry added.' });
    } catch (cause) {
      setToast({ tone: 'error', message: errorMessage(cause, 'Could not save health entry') });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }
    try {
      await healthApi.remove(id);
    } catch (cause) {
      setToast({ tone: 'error', message: errorMessage(cause, 'Could not delete entry') });
      return;
    }
    setPendingDelete(null);
    if (editingId === id) resetForm();
    await refresh();
    setToast({ tone: 'success', message: 'Health entry deleted.' });
  }

  function startEdit(entry: HealthTracking) {
    setEditingId(entry.id);
    setForm({
      metric: entry.metricId,
      value: String(entry.value),
      createdAt: new Date(entry.createdAt).toISOString().slice(0, 16),
    });
    setPendingDelete(null);
  }

  return (
    <PersonalShell
      {...shell}
      title="Health"
      description="Log readings such as weight, steps, or water — decimals are fine. The assistant can change these only after you confirm."
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Health entries" value={String(health.length)} hint="Newest first" tone="emerald" />
        <StatCard
          label="Latest reading"
          value={latest ? `${latest.metric} ${latest.value}` : '—'}
          hint={latest ? new Date(latest.createdAt).toLocaleString() : 'Add a metric below'}
        />
      </div>
      <FinanceCard title="Health tracking" description="Leave the date empty to use now.">
        <div className={`${financeStyles.inset} mb-5 grid gap-4 p-4 md:grid-cols-4`}>
          <Field label="Metric">
            <select
              className={financeStyles.input}
              value={form.metric}
              onChange={(event) => setForm({ ...form, metric: event.target.value })}
            >
              <option value="">Choose a metric</option>
              {metrics.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Value">
            <input
              className={financeStyles.input}
              inputMode="decimal"
              value={form.value}
              onChange={(event) => setForm({ ...form, value: event.target.value })}
              placeholder="80.5"
            />
          </Field>
          <Field label="When">
            <input
              className={financeStyles.input}
              type="datetime-local"
              onClick={openPicker}
              value={form.createdAt}
              onChange={(event) => setForm({ ...form, createdAt: event.target.value })}
            />
          </Field>
          <div className="flex items-end gap-2">
            <button type="button" className={financeStyles.primary} disabled={saving} onClick={() => void submit()}>
              {saving ? 'Saving…' : editingId ? 'Update' : 'Add'}
            </button>
            {editingId ? (
              <button type="button" className={financeStyles.secondary} onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        {!health.length ? (
          <p className="py-6 text-center text-sm text-slate-500">No health readings yet.</p>
        ) : (
          <div className="space-y-3">
            {health.map((entry) => (
              <article
                key={entry.id}
                className={`${financeStyles.inset} flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between`}
              >
                <div>
                  <p className="font-semibold text-white">
                    {entry.metric} · {entry.value}
                  </p>
                  <p className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className={financeStyles.secondary} onClick={() => startEdit(entry)}>
                    Edit
                  </button>
                  <button type="button" className={financeStyles.danger} onClick={() => void remove(entry.id)}>
                    {pendingDelete === entry.id ? 'Confirm delete' : 'Delete'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </FinanceCard>
      <div className="mt-6">
        <HealthChart entries={health} />
      </div>
      <div className="mt-6">
        <HealthMetrics metrics={metrics} onChange={refresh} onToast={setToast} />
      </div>
    </PersonalShell>
  );
}

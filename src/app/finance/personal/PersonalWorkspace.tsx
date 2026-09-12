'use client';

import { NAMAAZ_VALUES, type Namaaz } from '@/lib/db/schema';
import type { HealthTracking, Prayer } from '@/types/personal';
import { useEffect, useMemo, useState } from 'react';
import { FinanceToast, type FinanceToastState } from '../components/FinanceToast';
import { FinanceCard, FinancePageShell, StatCard, financeStyles } from '../components/FinanceUI';

const NAMAAZ_LABELS: Record<Namaaz, string> = {
  fajr: 'Fajr',
  zuhr: 'Zuhr',
  asar: 'Asar',
  maghreb: 'Maghreb',
  isha: 'Isha',
};

export function PersonalWorkspace({ view }: { view: 'prayers' | 'health' }) {
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [health, setHealth] = useState<HealthTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<FinanceToastState>(null);
  const [metric, setMetric] = useState('');
  const [value, setValue] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [savingHealth, setSavingHealth] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function refresh() {
    if (view === 'prayers') {
      const prayerResponse = await fetch('/api/prayers', { cache: 'no-store' });
      if (!prayerResponse.ok) throw new Error('Could not load prayers');
      setPrayers((await prayerResponse.json()) as Prayer[]);
      return;
    }
    const healthResponse = await fetch('/api/health-tracking', { cache: 'no-store' });
    if (!healthResponse.ok) throw new Error('Could not load health data');
    setHealth((await healthResponse.json()) as HealthTracking[]);
  }

  useEffect(() => {
    setLoading(true);
    void refresh()
      .catch((cause) => {
        setToast({
          tone: 'error',
          message: cause instanceof Error ? cause.message : 'Could not load personal data',
        });
      })
      .finally(() => setLoading(false));
  }, [view]);

  const prayerRows = useMemo(
    () =>
      NAMAAZ_VALUES.map((namaaz) => {
        const row = prayers.find((prayer) => prayer.namaaz === namaaz);
        return { namaaz, missed: row?.missed ?? 0, id: row?.id, updatedAt: row?.updatedAt };
      }),
    [prayers]
  );

  const totalMissed = prayerRows.reduce((sum, row) => sum + row.missed, 0);
  const latestHealth = health[0];

  async function savePrayer(namaaz: Namaaz, missed: number, id?: string) {
    const next = Math.max(0, missed);
    const response = id
      ? await fetch(`/api/prayers/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ missed: next }),
        })
      : await fetch('/api/prayers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ namaaz, missed: next }),
        });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      throw new Error(body.error || 'Could not save prayer');
    }
    await refresh();
    setToast({ tone: 'success', message: `${NAMAAZ_LABELS[namaaz]} updated.` });
  }

  async function submitHealth() {
    const parsedValue = Number(value);
    if (!metric.trim() || !Number.isInteger(parsedValue)) {
      setToast({ tone: 'error', message: 'Enter a metric and an integer value.' });
      return;
    }
    setSavingHealth(true);
    try {
      const payload = {
        metric: metric.trim(),
        value: parsedValue,
        ...(createdAt ? { createdAt } : {}),
      };
      const response = editingId
        ? await fetch(`/api/health-tracking/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/health-tracking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || 'Could not save health entry');
      }
      setMetric('');
      setValue('');
      setCreatedAt('');
      setEditingId(null);
      await refresh();
      setToast({ tone: 'success', message: editingId ? 'Health entry updated.' : 'Health entry added.' });
    } catch (cause) {
      setToast({ tone: 'error', message: cause instanceof Error ? cause.message : 'Could not save health entry' });
    } finally {
      setSavingHealth(false);
    }
  }

  async function removeHealth(id: string) {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }
    const response = await fetch(`/api/health-tracking/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setToast({ tone: 'error', message: body.error || 'Could not delete entry' });
      return;
    }
    setPendingDelete(null);
    if (editingId === id) {
      setEditingId(null);
      setMetric('');
      setValue('');
      setCreatedAt('');
    }
    await refresh();
    setToast({ tone: 'success', message: 'Health entry deleted.' });
  }

  function startEdit(entry: HealthTracking) {
    setEditingId(entry.id);
    setMetric(entry.metric);
    setValue(String(entry.value));
    setCreatedAt(new Date(entry.createdAt).toISOString().slice(0, 16));
    setPendingDelete(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading personal data…</p>
      </div>
    );
  }

  return (
    <>
      {view === 'prayers' ? (
        <FinancePageShell
          section="personal"
          title="Prayers"
          description="Track missed counts for each namaaz. The assistant can change these only after you confirm."
        >
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <StatCard label="Missed prayers" value={String(totalMissed)} hint="Across all five namaaz" tone="amber" />
            <StatCard
              label="Tracked namaaz"
              value={String(prayers.length)}
              hint="Rows saved so far"
              tone="cyan"
            />
          </div>
          <FinanceCard title="Prayers" description="One row per namaaz. Increase or decrease missed counts.">
            <div className="grid gap-3">
              {prayerRows.map((row) => (
                <div
                  key={row.namaaz}
                  className={`${financeStyles.inset} flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between`}
                >
                  <div>
                    <p className="font-semibold text-white">{NAMAAZ_LABELS[row.namaaz]}</p>
                    <p className="text-xs text-slate-500">
                      {row.updatedAt ? `Updated ${new Date(row.updatedAt).toLocaleString()}` : 'Not saved yet'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={financeStyles.secondary}
                      onClick={() =>
                        void savePrayer(row.namaaz, row.missed - 1, row.id).catch((cause) =>
                          setToast({ tone: 'error', message: cause.message })
                        )
                      }
                    >
                      −
                    </button>
                    <span className="min-w-10 text-center text-lg font-bold text-cyan-200">{row.missed}</span>
                    <button
                      type="button"
                      className={financeStyles.primary}
                      onClick={() =>
                        void savePrayer(row.namaaz, row.missed + 1, row.id).catch((cause) =>
                          setToast({ tone: 'error', message: cause.message })
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </FinanceCard>
        </FinancePageShell>
      ) : (
        <FinancePageShell
          section="personal"
          title="Health"
          description="Log integer readings such as weight, steps, or water. The assistant can change these only after you confirm."
        >
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <StatCard label="Health entries" value={String(health.length)} hint="Newest first" tone="emerald" />
            <StatCard
              label="Latest reading"
              value={latestHealth ? `${latestHealth.metric} ${latestHealth.value}` : '—'}
              hint={latestHealth ? new Date(latestHealth.createdAt).toLocaleString() : 'Add a metric below'}
            />
          </div>
          <FinanceCard
            title="Health tracking"
            description="Leave the date empty to use now."
          >
            <div className={`${financeStyles.inset} mb-5 grid gap-4 p-4 md:grid-cols-4`}>
              <label>
                <span className={financeStyles.label}>Metric</span>
                <input
                  className={financeStyles.input}
                  value={metric}
                  onChange={(event) => setMetric(event.target.value)}
                  placeholder="weight_kg"
                />
              </label>
              <label>
                <span className={financeStyles.label}>Value</span>
                <input
                  className={financeStyles.input}
                  inputMode="numeric"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="80"
                />
              </label>
              <label>
                <span className={financeStyles.label}>When</span>
                <input
                  className={financeStyles.input}
                  type="datetime-local"
                  value={createdAt}
                  onChange={(event) => setCreatedAt(event.target.value)}
                />
              </label>
              <div className="flex items-end gap-2">
                <button type="button" className={financeStyles.primary} disabled={savingHealth} onClick={() => void submitHealth()}>
                  {savingHealth ? 'Saving…' : editingId ? 'Update' : 'Add'}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    className={financeStyles.secondary}
                    onClick={() => {
                      setEditingId(null);
                      setMetric('');
                      setValue('');
                      setCreatedAt('');
                    }}
                  >
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
                      <button type="button" className={financeStyles.danger} onClick={() => void removeHealth(entry.id)}>
                        {pendingDelete === entry.id ? 'Confirm delete' : 'Delete'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </FinanceCard>
        </FinancePageShell>
      )}
      <FinanceToast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

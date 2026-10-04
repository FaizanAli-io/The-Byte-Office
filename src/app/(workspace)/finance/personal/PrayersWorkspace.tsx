'use client';

import { prayersApi } from '@/lib/api-client';
import { errorMessage } from '@/lib/client-api';
import { NAMAAZ_VALUES, type Namaaz, type Prayer } from '@/types/personal';
import { useCallback, useState } from 'react';
import { FinanceCard, StatCard, financeStyles } from '../components/FinanceUI';
import { PersonalShell, usePersonalData } from './PersonalShell';

const NAMAAZ_LABELS: Record<Namaaz, string> = {
  fajr: 'Fajr',
  zuhr: 'Zuhr',
  asar: 'Asar',
  maghreb: 'Maghreb',
  isha: 'Isha',
};

export function PrayersWorkspace() {
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const tracker = await prayersApi.list();
    setPrayers(tracker.prayers);
    setUpdatedAt(tracker.updatedAt);
  }, []);
  const shell = usePersonalData(refresh);
  const { setToast } = shell;

  const rows = NAMAAZ_VALUES.map((namaaz) => {
    const row = prayers.find((prayer) => prayer.namaaz === namaaz);
    return { namaaz, missed: row?.missed ?? 0, id: row?.id };
  });
  const totalMissed = rows.reduce((sum, row) => sum + row.missed, 0);

  async function savePrayer({ namaaz, missed, id }: (typeof rows)[number], step: number) {
    const next = Math.max(0, missed + step);
    try {
      await (id ? prayersApi.update(id, next) : prayersApi.create(namaaz, next));
      await refresh();
      setToast({ tone: 'success', message: `${NAMAAZ_LABELS[namaaz]} updated.` });
    } catch (cause) {
      setToast({ tone: 'error', message: errorMessage(cause, `Could not update ${NAMAAZ_LABELS[namaaz]}`) });
    }
  }

  return (
    <PersonalShell
      {...shell}
      title="Prayers"
      description="Track missed counts for each namaaz. The assistant can change these only after you confirm."
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Missed prayers" value={String(totalMissed)} hint="Across all five namaaz" tone="amber" />
        <StatCard
          label="Last updated"
          value={updatedAt ? new Date(updatedAt).toLocaleDateString() : 'Never'}
          hint={updatedAt ? new Date(updatedAt).toLocaleTimeString() : 'No change recorded yet'}
          tone="cyan"
        />
      </div>
      <FinanceCard title="Prayers" description="One row per namaaz. Increase or decrease missed counts.">
        <div className="grid gap-3">
          {rows.map((row) => (
            <div
              key={row.namaaz}
              className={`${financeStyles.inset} flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between`}
            >
              <p className="font-semibold text-white">{NAMAAZ_LABELS[row.namaaz]}</p>
              <div className="flex items-center gap-2">
                <button type="button" className={financeStyles.secondary} onClick={() => void savePrayer(row, -1)}>
                  −
                </button>
                <span className="min-w-10 text-center text-lg font-bold text-cyan-200">{row.missed}</span>
                <button type="button" className={financeStyles.primary} onClick={() => void savePrayer(row, 1)}>
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </FinanceCard>
    </PersonalShell>
  );
}

import { sql } from 'drizzle-orm';
import type { RateTable } from '@/lib/fx';
import { getDb } from './index';
import { exchangeRates } from './schema';

export type StoredRates = { currencies: RateTable; updatedAt: Date; checkedAt: Date };

export async function readStoredRates(): Promise<StoredRates | null> {
  const rows = await getDb().select().from(exchangeRates);
  if (!rows.length) return null;
  const latest = (key: 'updatedAt' | 'checkedAt') => new Date(Math.max(...rows.map((row) => row[key].getTime())));
  return {
    currencies: Object.fromEntries(rows.map((row) => [row.currency, row.value])),
    updatedAt: latest('updatedAt'),
    checkedAt: latest('checkedAt'),
  };
}

// A currency the provider stops quoting keeps its last value rather than vanishing from under a holding.
export async function writeStoredRates({ currencies, updatedAt, checkedAt }: StoredRates) {
  await getDb()
    .insert(exchangeRates)
    .values(Object.entries(currencies).map(([currency, value]) => ({ currency, value, updatedAt, checkedAt })))
    .onConflictDoUpdate({
      target: exchangeRates.currency,
      set: { value: sql`excluded.value`, updatedAt: sql`excluded.updated_at`, checkedAt: sql`excluded.checked_at` },
    });
}

export async function markRatesChecked(checkedAt: Date) {
  await getDb().update(exchangeRates).set({ checkedAt });
}

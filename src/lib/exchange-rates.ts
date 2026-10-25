import 'server-only';
import { ApiError } from '@/lib/api';
import { markRatesChecked, readStoredRates, writeStoredRates, type StoredRates } from '@/lib/db/exchange-rates';
import { PKR, rateOf, round2, type RateTable } from '@/lib/fx';

const PROVIDER_URL = 'https://open.er-api.com/v6/latest/PKR';
const HOUR = 60 * 60 * 1000;

export type ExchangeRates = { currencies: RateTable; updatedAt: Date; stale: boolean };

// The provider quotes units per PKR; we keep PKR per unit at 2 dp, so a currency worth under 1 PKR would round to
// nothing useful and is left out.
export function toRateTable(payload: unknown): RateTable | null {
  const { result, rates } = (payload ?? {}) as { result?: unknown; rates?: Record<string, unknown> };
  if (result !== 'success' || typeof rates !== 'object' || rates === null) return null;
  const table: RateTable = {};
  for (const [code, perPkr] of Object.entries(rates)) {
    if (code === PKR || typeof perPkr !== 'number' || !(perPkr > 0)) continue;
    const rate = round2(1 / perPkr);
    if (rate >= 1) table[code] = rate;
  }
  return Object.keys(table).length ? table : null;
}

async function fetchProvider(): Promise<RateTable | null> {
  try {
    const response = await fetch(PROVIDER_URL, { signal: AbortSignal.timeout(3000), cache: 'no-store' });
    return response.ok ? toRateTable(await response.json()) : null;
  } catch {
    return null;
  }
}

const present = (row: StoredRates, now: number): ExchangeRates => ({
  currencies: row.currencies,
  updatedAt: row.updatedAt,
  stale: now - row.updatedAt.getTime() > HOUR,
});

let cached: StoredRates | null = null;

async function store(currencies: RateTable, stored: StoredRates | null, now: number) {
  const at = new Date(now);
  await writeStoredRates({ currencies, updatedAt: at, checkedAt: at });
  // Stored rows the provider no longer quotes are kept, so the copy in memory keeps them too.
  cached = { currencies: { ...stored?.currencies, ...currencies }, updatedAt: at, checkedAt: at };
  return present(cached, now);
}

// The provider is asked at most once an hour; a failed attempt counts, so an outage costs one timeout an hour.
export async function getExchangeRates(): Promise<ExchangeRates> {
  const now = Date.now();
  const fresh = (row: StoredRates) => now - row.checkedAt.getTime() < HOUR;
  if (cached && fresh(cached)) return present(cached, now);

  const stored = await readStoredRates();
  if (stored && fresh(stored)) return present((cached = stored), now);

  const currencies = await fetchProvider();
  if (currencies) return store(currencies, stored, now);
  if (!stored) throw new ApiError('Exchange rates unavailable', 503);
  const checkedAt = new Date(now);
  await markRatesChecked(checkedAt);
  cached = { ...stored, checkedAt };
  return present(cached, now);
}

// On demand, ignoring the hourly limit. A failure changes nothing, so the stored rates stay as they were.
export async function refreshExchangeRates(): Promise<ExchangeRates> {
  const currencies = await fetchProvider();
  if (!currencies) throw new ApiError('The rate provider did not answer; the stored rates are unchanged', 502);
  return store(currencies, await readStoredRates(), Date.now());
}

export async function liveRates(): Promise<RateTable> {
  return (await getExchangeRates()).currencies;
}

// Server-side rate lookups fail loudly: a missing rate must never be saved or summed as NaN.
// `label` names the holding or account, so the error says which row to fix.
export function requireRate(rates: RateTable, code: string, label?: string) {
  const rate = rateOf(rates, code);
  if (rate === undefined) throw new ApiError(`${label ? `${label}: ` : ''}${code} isn't a supported currency`);
  return rate;
}

export async function assertSupportedCurrencies(items: { name: string; currency: string }[]) {
  const rates = await ratesFor(items.map((item) => item.currency));
  for (const item of items) requireRate(rates, item.currency, item.name);
}

// Only pay for a rate lookup when something actually needs converting.
export const ratesFor = (codes: string[]): Promise<RateTable> =>
  codes.some((code) => code !== PKR) ? liveRates() : Promise.resolve({});

export function resetExchangeRateCache() {
  cached = null;
}

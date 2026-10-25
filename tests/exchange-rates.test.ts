import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredRates } from '@/lib/db/exchange-rates';

// Nothing touches a database: the one-row store is an in-memory variable.
let stored: StoredRates | null = null;
vi.mock('@/lib/db/exchange-rates', () => ({
  readStoredRates: async () => stored,
  writeStoredRates: async (row: StoredRates) => void (stored = row),
  markRatesChecked: async (checkedAt: Date) => void (stored = stored && { ...stored, checkedAt }),
}));

const { getExchangeRates, refreshExchangeRates, requireRate, resetExchangeRateCache, toRateTable } =
  await import('@/lib/exchange-rates');

const NOW = new Date('2026-10-25T12:00:00Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);
const provider = { result: 'success', rates: { PKR: 1, USD: 0.00356, GBP: 0.002806, JPY: 0.5, IDR: 57 } };
const fetchMock = vi.fn();

beforeEach(() => {
  stored = null;
  resetExchangeRateCache();
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => provider });
  vi.stubGlobal('fetch', fetchMock);
});

describe('toRateTable', () => {
  it('inverts to PKR per unit at 2 dp and drops PKR and currencies worth under a rupee', () =>
    expect(toRateTable(provider)).toEqual({ USD: 280.9, GBP: 356.38, JPY: 2 }));

  it('rejects a payload that is not a success', () => {
    expect(toRateTable({ result: 'error' })).toBeNull();
    expect(toRateTable({ result: 'success', rates: 'nope' })).toBeNull();
    expect(toRateTable(null)).toBeNull();
  });
});

describe('getExchangeRates', () => {
  it('fetches and stores the table when nothing is stored', async () => {
    expect(await getExchangeRates()).toEqual({ currencies: toRateTable(provider), updatedAt: NOW, stale: false });
    expect(stored).toMatchObject({ updatedAt: NOW, checkedAt: NOW });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('serves a row checked under an hour ago without calling the provider', async () => {
    stored = { currencies: { USD: 280 }, updatedAt: hoursAgo(0.5), checkedAt: hoursAgo(0.5) };
    expect((await getExchangeRates()).currencies).toEqual({ USD: 280 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes a row checked over an hour ago, once', async () => {
    stored = { currencies: { USD: 280 }, updatedAt: hoursAgo(2), checkedAt: hoursAgo(2) };
    expect((await getExchangeRates()).currencies.USD).toBe(280.9);
    await getExchangeRates();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    ['a network error', () => fetchMock.mockRejectedValue(new Error('offline'))],
    ['an error status', () => fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })],
    ['a malformed payload', () => fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: 'x' }) })],
  ])('falls back to the stored row, marked stale, on %s', async (_label, fail) => {
    fail();
    stored = { currencies: { USD: 280 }, updatedAt: hoursAgo(3), checkedAt: hoursAgo(3) };
    expect(await getExchangeRates()).toEqual({ currencies: { USD: 280 }, updatedAt: hoursAgo(3), stale: true });
  });

  it('counts a failed attempt, so the next call waits an hour', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    stored = { currencies: { USD: 280 }, updatedAt: hoursAgo(3), checkedAt: hoursAgo(3) };
    await getExchangeRates();
    resetExchangeRateCache();
    await getExchangeRates();
    expect(stored?.checkedAt).toEqual(NOW);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('fails clearly with nothing stored and the provider down', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(getExchangeRates()).rejects.toThrow('Exchange rates unavailable');
  });

  it('asks the provider with a 3 s timeout', async () => {
    await getExchangeRates();
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});

describe('requireRate', () => {
  it('prices PKR at 1, a known code at its rate, and refuses an unknown one', () => {
    expect(requireRate({}, 'PKR')).toBe(1);
    expect(requireRate({ USD: 280 }, 'USD')).toBe(280);
    expect(() => requireRate({ USD: 280 }, 'GBP')).toThrow("GBP isn't a supported currency");
    expect(() => requireRate({ USD: 280 }, 'USX', 'Wise')).toThrow("Wise: USX isn't a supported currency");
  });
});

describe('refreshExchangeRates', () => {
  it('fetches even when the stored row is fresh, stores it, and returns the new table', async () => {
    stored = { currencies: { USD: 280, XAU: 900_000 }, updatedAt: hoursAgo(0.1), checkedAt: hoursAgo(0.1) };
    expect(await refreshExchangeRates()).toEqual({
      currencies: { ...toRateTable(provider), XAU: 900_000 },
      updatedAt: NOW,
      stale: false,
    });
    expect(stored).toMatchObject({ updatedAt: NOW, checkedAt: NOW });
    expect((await getExchangeRates()).currencies.USD).toBe(280.9);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('leaves the stored rates untouched when the provider fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const before = { currencies: { USD: 280 }, updatedAt: hoursAgo(2), checkedAt: hoursAgo(2) };
    stored = before;
    await expect(refreshExchangeRates()).rejects.toThrow('stored rates are unchanged');
    expect(stored).toBe(before);
  });
});

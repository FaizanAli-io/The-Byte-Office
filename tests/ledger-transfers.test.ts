import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryChanges } from '@/lib/db/queries';
import type { LedgerEntry, MonthlyLedger } from '@/types/ledger';

// Nothing touches a database: writes are captured, and the "saved" ledger is the input with the changes applied.
let ledger: MonthlyLedger;
let written: EntryChanges[] = [];
let live: Record<string, number> = {};
const categories = new Map<string, string>();

vi.mock('@/lib/db/queries', () => ({
  loadLedger: async () => ledger,
  listCategories: async () => [],
  ensureCategory: async ({ name }: { name: string }) => {
    if (!categories.has(name)) categories.set(name, `cat-${categories.size + 1}`);
    return categories.get(name)!;
  },
  writeLedgerEntries: async (_ledger: MonthlyLedger, changes: EntryChanges) => {
    written.push(changes);
    const touched = new Map([...changes.update, ...changes.insert].map((entry) => [entry.id, entry]));
    ledger = {
      ...ledger,
      entries: [
        ...ledger.entries.filter((e) => !changes.remove.includes(e.id)).map((e) => touched.get(e.id) ?? e),
        ...changes.insert,
      ],
    };
    return ledger;
  },
}));
vi.mock('@/lib/exchange-rates', () => ({
  ratesFor: async () => live,
  requireRate: (rates: Record<string, number>, code: string) => (code === 'PKR' ? 1 : rates[code]),
}));

const { changeLedgerEntry } = await import('@/lib/ledger-entries');

const transfer = (changes: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id: 't',
  date: '2026-10-05',
  type: 'transfer',
  accountId: 'deel',
  destinationAccountId: 'personal',
  amount: 1000,
  destinationAmount: 279_000,
  ...changes,
});
const costOf = () => ledger.entries.find((entry) => entry.id !== 't' && entry.accountId === 'deel');

beforeEach(() => {
  written = [];
  live = { USD: 280.92 };
  categories.clear();
  ledger = {
    id: 'l',
    month: '2026-10',
    status: 'draft',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    accounts: [
      { id: 'deel', name: 'Deel', type: 'bank', currency: 'USD', openingBalance: 5000, exchangeRate: 280.92 },
      { id: 'personal', name: 'Personal', type: 'bank', currency: 'PKR', openingBalance: 0, exchangeRate: 1 },
      { id: 'hbl', name: 'HBL', type: 'bank', currency: 'PKR', openingBalance: 100_000, exchangeRate: 1 },
    ],
    entries: [],
  };
});

describe('adding a transfer', () => {
  it('writes the transfer and a separate exchange cost in one change set, at stamped live rates', async () => {
    await changeLedgerEntry('2026-10', { kind: 'add', entry: transfer({ exchangeRate: 1 }) });
    expect(written).toHaveLength(1);
    expect(written[0].insert).toEqual([
      expect.objectContaining({ id: 't', amount: 993.17, destinationAmount: 279_000, exchangeRate: 280.92 }),
      {
        id: expect.any(String),
        date: '2026-10-05',
        type: 'expense',
        accountId: 'deel',
        amount: 6.83,
        exchangeRate: 280.92,
        categoryId: categories.get('Exchange cost'),
        note: 'Received at USD/PKR 279.00; market 280.92',
      },
    ]);
  });

  it('records a better rate as an exchange gain', async () => {
    await changeLedgerEntry('2026-10', { kind: 'add', entry: transfer({ destinationAmount: 282_000 }) });
    expect(costOf()).toMatchObject({ type: 'income', amount: 3.84, categoryId: categories.get('Exchange gain') });
  });

  it('defaults a same-currency transfer to arriving in full, and files a shortfall as a fee', async () => {
    const pkr = { accountId: 'hbl', destinationAccountId: 'personal', amount: 50_000 };
    await changeLedgerEntry('2026-10', { kind: 'add', entry: transfer({ ...pkr, destinationAmount: undefined }) });
    expect(ledger.entries).toEqual([expect.objectContaining({ amount: 50_000, destinationAmount: 50_000 })]);

    await changeLedgerEntry('2026-10', {
      kind: 'add',
      entry: transfer({ ...pkr, id: 'u', destinationAmount: 49_900 }),
    });
    expect(ledger.entries.at(-1)).toMatchObject({ type: 'expense', accountId: 'hbl', amount: 100, note: undefined });
    expect([...categories.keys()]).toEqual(['Transfer fees']);
  });

  it('refuses receiving more than was sent in the same currency, and a missing received amount across them', async () => {
    const pkr = transfer({ accountId: 'hbl', amount: 100, destinationAmount: 101 });
    await expect(changeLedgerEntry('2026-10', { kind: 'add', entry: pkr })).rejects.toThrow("can't exceed sent");
    const blank = transfer({ destinationAmount: undefined });
    await expect(changeLedgerEntry('2026-10', { kind: 'add', entry: blank })).rejects.toThrow('amount received');
    expect(written).toEqual([]);
  });
});

describe('after a transfer is added', () => {
  beforeEach(async () => {
    await changeLedgerEntry('2026-10', { kind: 'add', entry: transfer() });
    written = [];
  });

  it('saves an edited transfer as given, without splitting it again or touching the cost', async () => {
    live = { USD: 300 };
    const edited = { ...ledger.entries[0], note: 'Salary', destinationAmount: 270_000 };
    await changeLedgerEntry('2026-10', { kind: 'update', entry: edited });
    expect(written).toEqual([{ insert: [], update: [{ ...edited, exchangeRate: 280.92 }], remove: [] }]);
    expect(costOf()).toMatchObject({ amount: 6.83 });
  });

  it('lets the cost entry be edited and removed on its own, leaving the transfer', async () => {
    const cost = costOf()!;
    await changeLedgerEntry('2026-10', { kind: 'update', entry: { ...cost, amount: 7 } });
    expect(costOf()?.amount).toBe(7);
    await changeLedgerEntry('2026-10', { kind: 'remove', id: cost.id });
    expect(ledger.entries.map((entry) => entry.id)).toEqual(['t']);
  });

  it('removes only the transfer when the transfer is removed', async () => {
    await changeLedgerEntry('2026-10', { kind: 'remove', id: 't' });
    expect(written).toEqual([{ insert: [], update: [], remove: ['t'] }]);
    expect(costOf()).toBeDefined();
  });
});

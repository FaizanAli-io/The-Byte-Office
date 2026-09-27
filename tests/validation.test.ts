import { describe, expect, it } from 'vitest';
import { validateFinanceDoc, validateLedger, validateSnapshotInput } from '@/lib/finance-validation';
import {
  healthInputSchema,
  healthUpdateSchema,
  prayerInputSchema,
  prayerUpdateSchema,
} from '@/lib/personal-validation';
import { parseInquiry } from '@/lib/inquiry-email';
import type { MonthlyLedgerPayload } from '@/types/ledger';

const doc = () => ({
  name: 'finance',
  localBanks: [{ id: 'a', name: 'HBL', amountPkr: 10 }],
  remoteBanks: [{ id: 'b', name: 'Wise', amountUsd: 5, exchangeRate: 280 }],
  mutualFunds: [{ Meezan: [{ id: 'c', fund: 'Cash', value: 1 }] }],
});

describe('validateFinanceDoc', () => {
  it('accepts a document with ids', () => expect(validateFinanceDoc(doc())).toBe(true));
  it('accepts rows the editor has just added, which have no id', () =>
    expect(validateFinanceDoc({ ...doc(), localBanks: [{ name: 'New', amountPkr: 0 }] })).toBe(true));
  it('rejects a negative balance', () =>
    expect(validateFinanceDoc({ ...doc(), localBanks: [{ name: 'X', amountPkr: -1 }] })).toBe(false));
  it('rejects a zero exchange rate', () =>
    expect(validateFinanceDoc({ ...doc(), remoteBanks: [{ name: 'X', amountUsd: 1, exchangeRate: 0 }] })).toBe(false));
  it('rejects a blank name', () =>
    expect(validateFinanceDoc({ ...doc(), localBanks: [{ name: '  ', amountPkr: 1 }] })).toBe(false));
  it('rejects a non-string id', () =>
    expect(validateFinanceDoc({ ...doc(), localBanks: [{ id: 7, name: 'X', amountPkr: 1 }] })).toBe(false));

  it('rejects duplicate ids, which would collapse into one update', () => {
    const banks = [
      { id: 'dup', name: 'X', amountPkr: 1 },
      { id: 'dup', name: 'Y', amountPkr: 2 },
    ];
    expect(validateFinanceDoc({ ...doc(), localBanks: banks })).toBe(false);
  });

  it('allows the same id in two different tables', () => {
    const value = {
      ...doc(),
      localBanks: [{ id: 'z', name: 'X', amountPkr: 1 }],
      remoteBanks: [{ id: 'z', name: 'W', amountUsd: 1, exchangeRate: 2 }],
    };
    expect(validateFinanceDoc(value)).toBe(true);
  });
});

describe('validateSnapshotInput', () => {
  it('accepts a valid snapshot', () => expect(validateSnapshotInput({ data: doc(), grandTotal: 10 })).toBeNull());
  it('rejects a negative total', () =>
    expect(validateSnapshotInput({ data: doc(), grandTotal: -1 })).toBe('Invalid portfolio total'));
});

describe('validateLedger', () => {
  const base = (): MonthlyLedgerPayload => ({
    month: '2026-03',
    status: 'draft',
    accounts: [
      { id: 'a', name: 'PKR bank', type: 'bank', currency: 'PKR', openingBalance: 0, exchangeRate: 1 },
      { id: 'b', name: 'USD bank', type: 'bank', currency: 'USD', openingBalance: 0, exchangeRate: 280 },
    ],
    entries: [{ id: 'e1', date: '2026-03-05', type: 'expense', accountId: 'a', amount: 10 }],
  });

  const KNOWN_CATEGORIES = new Set(['cat-1']);

  it('accepts a well-formed draft', () => expect(validateLedger(base())).toBeNull());

  it('accepts an entry pointing at a known category', () => {
    const entries = [
      { id: 'e1', date: '2026-03-05', type: 'expense' as const, accountId: 'a', amount: 10, categoryId: 'cat-1' },
    ];
    expect(validateLedger({ ...base(), entries }, KNOWN_CATEGORIES)).toBeNull();
  });

  it('refuses a category that does not exist, rather than letting the foreign key 500', () => {
    const entries = [
      { id: 'e1', date: '2026-03-05', type: 'expense' as const, accountId: 'a', amount: 10, categoryId: 'gone' },
    ];
    expect(validateLedger({ ...base(), entries }, KNOWN_CATEGORIES)).toBe('Unknown category');
  });

  it('accepts a hold against a bank account', () => {
    const entries = [
      { id: 'h1', date: '2026-03-05', type: 'hold_received' as const, accountId: 'a', amount: 50, counterparty: 'Ali' },
    ];
    expect(validateLedger({ ...base(), entries })).toBeNull();
  });

  it('refuses a hold parked on a fund, which would skew the cost basis', () => {
    const payload = base();
    payload.accounts.push({
      id: 'f',
      name: 'Meezan Cash',
      type: 'fund',
      currency: 'PKR',
      openingBalance: 0,
      exchangeRate: 1,
    });
    payload.entries = [{ id: 'h1', date: '2026-03-05', type: 'hold_returned', accountId: 'f', amount: 50 }];
    expect(validateLedger(payload)).toMatch(/bank account/);
  });

  it('refuses a blank counterparty', () => {
    const entries = [
      { id: 'h1', date: '2026-03-05', type: 'hold_received' as const, accountId: 'a', amount: 50, counterparty: '  ' },
    ];
    expect(validateLedger({ ...base(), entries })).toMatch(/Counterparty/);
  });
  it('rejects a malformed month', () => expect(validateLedger({ ...base(), month: '2026-13' })).toBe('Invalid month'));

  it('rejects an entry dated outside its month', () => {
    const payload = { ...base(), entries: [{ ...base().entries[0], date: '2026-04-01' }] };
    expect(validateLedger(payload)).toMatch(/valid date in this month/);
  });

  it('rejects an entry pointing at an unknown account', () => {
    const payload = { ...base(), entries: [{ ...base().entries[0], accountId: 'ghost' }] };
    expect(validateLedger(payload)).toMatch(/valid account/);
  });

  it('rejects a non-positive amount', () => {
    const payload = { ...base(), entries: [{ ...base().entries[0], amount: 0 }] };
    expect(validateLedger(payload)).toMatch(/positive amount/);
  });

  it('rejects duplicate entry ids', () => {
    const payload = { ...base(), entries: [base().entries[0], base().entries[0]] };
    expect(validateLedger(payload)).toBe('Entry IDs must be unique');
  });

  it('rejects a transfer to the same account', () => {
    const entries = [{ ...base().entries[0], type: 'transfer' as const, destinationAccountId: 'a' }];
    expect(validateLedger({ ...base(), entries })).toMatch(/two different valid accounts/);
  });

  it('requires a destination amount when currencies differ', () => {
    const entries = [{ ...base().entries[0], type: 'transfer' as const, destinationAccountId: 'b' }];
    expect(validateLedger({ ...base(), entries })).toMatch(/Cross-currency transfers/);
  });

  it('accepts a cross-currency transfer that states the destination amount', () => {
    const entries = [
      { ...base().entries[0], type: 'transfer' as const, destinationAccountId: 'b', destinationAmount: 0.04 },
    ];
    expect(validateLedger({ ...base(), entries })).toBeNull();
  });

  it('refuses to finalize before every account is reconciled', () => {
    expect(validateLedger({ ...base(), status: 'finalized' })).toMatch(/actual closing balance/);
  });

  it('finalizes once every account has an actual closing balance', () => {
    const accounts = base().accounts.map((account) => ({ ...account, actualClosingBalance: 0 }));
    expect(validateLedger({ ...base(), status: 'finalized', accounts })).toBeNull();
  });
});

describe('personal schemas', () => {
  it('accepts a prayer', () => expect(prayerInputSchema.safeParse({ namaaz: 'fajr', missed: 3 }).success).toBe(true));
  it('defaults missed to absent rather than requiring it', () =>
    expect(prayerInputSchema.safeParse({ namaaz: 'isha' }).success).toBe(true));
  it('rejects an unknown namaaz', () => expect(prayerInputSchema.safeParse({ namaaz: 'nope' }).success).toBe(false));
  it('rejects a fractional missed count', () =>
    expect(prayerInputSchema.safeParse({ namaaz: 'fajr', missed: 1.5 }).success).toBe(false));

  it('rejects an update with no fields, which would be a silent no-op', () => {
    expect(prayerUpdateSchema.safeParse({}).success).toBe(false);
    expect(healthUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('trims the health metric', () =>
    expect(healthInputSchema.parse({ metric: '  water  ', value: 8 }).metric).toBe('water'));
  it('coerces an ISO string to a date', () =>
    expect(healthInputSchema.parse({ metric: 'w', value: 1, createdAt: '2026-01-02' }).createdAt).toBeInstanceOf(Date));
  it('rejects an unparseable date', () =>
    expect(healthInputSchema.safeParse({ metric: 'w', value: 1, createdAt: 'nope' }).success).toBe(false));

  // Weight, temperature and glucose are not whole numbers.
  it.each([[72.5], [36.65], [0.125], [-1.5], [0]])('accepts the decimal reading %s', (value) => {
    expect(healthInputSchema.parse({ metric: 'weight_kg', value }).value).toBe(value);
  });

  it('accepts a decimal on update too', () => {
    expect(healthUpdateSchema.parse({ value: 18.4 }).value).toBe(18.4);
  });

  it.each([[Number.NaN], [Number.POSITIVE_INFINITY], ['80'], [null]])('still rejects %s', (value) => {
    expect(healthInputSchema.safeParse({ metric: 'w', value }).success).toBe(false);
  });
});

describe('parseInquiry', () => {
  const ok = { name: 'Ada', email: 'ada@example.com', message: 'Hello' };

  it('keeps only the fields that were supplied', () => {
    expect(parseInquiry(ok)).toEqual({ name: 'Ada', email: 'ada@example.com', message: 'Hello' });
  });

  it('trims and preserves optional fields', () => {
    expect(parseInquiry({ ...ok, company: ' Acme ', service: 'Other' })).toMatchObject({
      company: 'Acme',
      service: 'Other',
    });
  });

  it('drops blank optional fields', () => {
    expect(parseInquiry({ ...ok, company: '   ' }).company).toBeUndefined();
  });

  it.each([
    ['a missing name', { ...ok, name: '' }],
    ['a malformed email', { ...ok, email: 'nope' }],
    ['a blank message', { ...ok, message: '  ' }],
    ['an oversized message', { ...ok, message: 'x'.repeat(5001) }],
    ['a non-object', 'nope'],
  ])('rejects %s', (_label, value) => {
    expect(() => parseInquiry(value)).toThrow();
  });
});

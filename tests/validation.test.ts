import { describe, expect, it } from 'vitest';
import { parsePortfolio, parseSnapshotInput, validateLedger } from '@/lib/finance-validation';
import {
  healthByNameSchema,
  healthInputSchema,
  healthMetricInputSchema,
  healthUpdateSchema,
  prayerInputSchema,
  prayerUpdateSchema,
} from '@/lib/personal-validation';
import { parseInquiry } from '@/lib/inquiry-email';
import type { HoldingInput } from '@/types/finance';
import type { LedgerDraft } from '@/types/ledger';

const portfolio = (holdings: unknown[] = []) => ({
  holdings: [
    { id: 'a', kind: 'local_bank', name: 'HBL', group: null, amount: 10 },
    { id: 'b', kind: 'remote_bank', name: 'Wise', group: null, currency: 'USD', amount: 5 },
    { id: 'c', kind: 'mutual_fund', name: 'Cash', group: 'Meezan', amount: 1 },
    ...holdings,
  ],
});

const METRIC = '6a13aeac-c3fc-4e56-8ed7-876b55c05827';

describe('parsePortfolio', () => {
  it('accepts holdings with ids and holdings just added without one', () => {
    expect(parsePortfolio(portfolio([{ kind: 'local_bank', name: 'New', amount: 0 }]))).toHaveLength(4);
  });
  it('normalizes: only funds keep a group, a typed rate is dropped, and local holdings are PKR', () => {
    const [parsed] = parsePortfolio({
      holdings: [{ kind: 'local_bank', name: ' HBL ', group: 'x', amount: 1, exchangeRate: 9 }],
    }) as HoldingInput[];
    expect(parsed).toEqual({ kind: 'local_bank', name: 'HBL', group: null, currency: 'PKR', amount: 1 });
  });
  it.each([
    [
      'a negative amount',
      { kind: 'local_bank', name: 'X', amount: -1 },
      'X: the amount must be a number, zero or more',
    ],
    [
      'a remote bank without a currency',
      { kind: 'remote_bank', name: 'Wise', amount: 1 },
      'Wise: enter a three-letter currency code, such as USD',
    ],
    [
      'a remote bank in PKR',
      { kind: 'remote_bank', name: 'Wise', amount: 1, currency: 'PKR' },
      'Wise: a remote bank holds a foreign currency, not PKR',
    ],
    [
      'a malformed currency',
      { kind: 'remote_bank', name: 'Wise', amount: 1, currency: 'usd' },
      'Wise: enter a three-letter currency code, such as USD',
    ],
    [
      'a local bank in a foreign currency',
      { kind: 'local_bank', name: 'HBL', amount: 1, currency: 'USD' },
      'HBL: only remote banks hold a foreign currency',
    ],
    ['a blank name', { kind: 'local_bank', name: '  ', amount: 1 }, 'Every local bank needs a name'],
    ['a fund without a bank', { kind: 'mutual_fund', name: 'Cash', amount: 1 }, 'Cash: a fund needs its bank'],
    ['an unknown kind', { kind: 'crypto', name: 'X', amount: 1 }, 'A holding has an unknown kind'],
    ['a non-string id', { id: 7, kind: 'local_bank', name: 'X', amount: 1 }, 'X: invalid id'],
    ['a duplicate id', { id: 'a', kind: 'local_bank', name: 'X', amount: 1 }, 'X: listed twice'],
    ['a non-object', 'nope', 'Invalid portfolio data'],
  ])('rejects %s, naming the row', (_label, holding, message) =>
    expect(parsePortfolio(portfolio([holding]))).toBe(message)
  );
});

describe('parseSnapshotInput', () => {
  it('accepts a valid snapshot, ignoring any total the client sends', () =>
    expect(parseSnapshotInput({ data: portfolio(), grandTotal: -1 })).toEqual(parsePortfolio(portfolio())));
  it('passes on the holding error', () =>
    expect(parseSnapshotInput({ data: portfolio([{ kind: 'mutual_fund', name: 'Cash', amount: 1 }]) })).toBe(
      'Cash: a fund needs its bank'
    ));
});

describe('validateLedger', () => {
  const base = (): LedgerDraft => ({
    month: '2026-03',
    status: 'draft',
    updatedAt: '2026-03-01T00:00:00.000Z',
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
  it('rejects a malformed or duplicated portfolio link', () => {
    const linked = (holdingId: string) => ({ ...base().accounts[0], holdingId });
    expect(validateLedger({ ...base(), accounts: [linked('nope')] })).toBe('Invalid portfolio link');
    const id = '3ced5a60-1dc3-40f5-9632-a4f81fe35544';
    expect(validateLedger({ ...base(), accounts: [linked(id), { ...linked(id), id: 'b' }] })).toBe(
      'Each portfolio holding can have only one account'
    );
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

  it('refuses a fund in a foreign currency and a malformed code', () => {
    const fund = { id: 'f', name: 'Fund', type: 'fund' as const, currency: 'USD', openingBalance: 0, exchangeRate: 1 };
    expect(validateLedger({ ...base(), accounts: [...base().accounts, fund] })).toBe('Invalid currency');
    const odd = { ...base().accounts[0], id: 'z', currency: 'dollars' };
    expect(validateLedger({ ...base(), accounts: [...base().accounts, odd] })).toBe('Invalid currency');
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
    expect(healthByNameSchema.parse({ metric: '  water  ', value: 8 }).metric).toBe('water'));
  it('coerces an ISO string to a date', () =>
    expect(healthInputSchema.parse({ metricId: METRIC, value: 1, createdAt: '2026-01-02' }).createdAt).toBeInstanceOf(
      Date
    ));
  it('rejects an unparseable date', () =>
    expect(healthInputSchema.safeParse({ metricId: METRIC, value: 1, createdAt: 'nope' }).success).toBe(false));

  it.each([[72.5], [36.65], [0.125], [-1.5], [0]])('accepts the decimal reading %s', (value) => {
    expect(healthInputSchema.parse({ metricId: METRIC, value }).value).toBe(value);
  });

  it('accepts a decimal on update too', () => {
    expect(healthUpdateSchema.parse({ value: 18.4 }).value).toBe(18.4);
  });

  it.each([[Number.NaN], [Number.POSITIVE_INFINITY], ['80'], [null]])('still rejects %s', (value) => {
    expect(healthInputSchema.safeParse({ metricId: METRIC, value }).success).toBe(false);
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

describe('health metrics', () => {
  it('requires a real metric id on a reading', () =>
    expect(healthInputSchema.safeParse({ metricId: 'Weight (KG)', value: 90 }).success).toBe(false));
  it('trims a metric name and refuses an empty one', () => {
    expect(healthMetricInputSchema.parse({ name: '  Weight (KG) ' }).name).toBe('Weight (KG)');
    expect(healthMetricInputSchema.safeParse({ name: '   ' }).success).toBe(false);
  });
});

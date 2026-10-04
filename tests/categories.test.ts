import { describe, expect, it } from 'vitest';
import { categoryName, pickableCategories, resolveCategoryId, ledgerCategoryTotals } from '@/lib/ledger';
import type { LedgerAccount, LedgerCategory, LedgerEntry } from '@/types/ledger';

describe('categories', () => {
  const category = (over: Partial<LedgerCategory>): LedgerCategory => ({
    id: 'c1',
    name: 'Groceries',
    kind: 'both',
    sortOrder: 0,
    archivedAt: null,
    entryCount: 0,
    ...over,
  });

  const list = [
    category({ id: 'salary', name: 'Salary', kind: 'income' }),
    category({ id: 'food', name: 'Food', kind: 'expense' }),
    category({ id: 'travel', name: 'Travel', kind: 'both' }),
    category({ id: 'old', name: 'Old thing', kind: 'both', archivedAt: '2026-01-01T00:00:00.000Z' }),
  ];

  describe('categoryName', () => {
    it('resolves an id to its name', () => expect(categoryName(list, 'food')).toBe('Food'));
    it('is blank for an entry with no category', () => expect(categoryName(list, undefined)).toBe(''));
    it('is blank for an id that no longer exists', () => expect(categoryName(list, 'gone')).toBe(''));
  });

  describe('resolveCategoryId', () => {
    it('matches a name exactly, ignoring case and padding', () => {
      expect(resolveCategoryId(list, '  food ')).toBe('food');
      expect(resolveCategoryId(list, 'FOOD')).toBe('food');
    });

    it('accepts a partial match when only one category could be meant', () => {
      expect(resolveCategoryId(list, 'trav')).toBe('travel');
    });

    it('prefers an exact match over a longer name containing it', () => {
      const withBoth = [...list, category({ id: 'food-out', name: 'Food out' })];
      expect(resolveCategoryId(withBoth, 'Food')).toBe('food');
    });

    it('resolves to nothing when the name is ambiguous, rather than guessing', () => {
      const withBoth = [...list, category({ id: 'food-out', name: 'Food out' })];
      expect(resolveCategoryId(withBoth, 'foo')).toBeUndefined();
    });

    it('will not revive an archived category by name', () => {
      expect(resolveCategoryId(list, 'Old thing')).toBeUndefined();
    });

    it.each([[''], ['   '], [null], [undefined], [42]])('resolves %s to nothing', (value) => {
      expect(resolveCategoryId(list, value)).toBeUndefined();
    });
  });

  describe('pickableCategories', () => {
    const ids = (type: LedgerEntry['type'], keep?: string) =>
      pickableCategories(list, type, keep).map((item) => item.id);

    it('offers income categories and the either ones to income', () => {
      expect(ids('income')).toEqual(['salary', 'travel']);
    });

    it('offers expense categories and the either ones to expense', () => {
      expect(ids('expense')).toEqual(['food', 'travel']);
    });

    it('offers everything unarchived to a type that is neither', () => {
      expect(ids('transfer')).toEqual(['salary', 'food', 'travel']);
    });

    it('hides archived categories', () => {
      expect(ids('transfer')).not.toContain('old');
    });

    it('keeps the entry own archived category, so editing does not blank it', () => {
      expect(ids('expense', 'old')).toContain('old');
    });

    it('keeps a held category even when its kind does not suit the type', () => {
      expect(ids('expense', 'salary')).toContain('salary');
    });
  });
});

describe('ledgerCategoryTotals', () => {
  it('totals income and expenses per category in PKR, largest first', () => {
    const accounts: LedgerAccount[] = [
      { id: 'pkr', name: 'HBL', type: 'bank', currency: 'PKR', openingBalance: 0, exchangeRate: 1 },
      { id: 'usd', name: 'Wise', type: 'bank', currency: 'USD', openingBalance: 0, exchangeRate: 280 },
    ];
    const categories = [
      { id: 'food', name: 'Food', kind: 'expense', sortOrder: 0, archivedAt: null, entryCount: 0 },
      { id: 'pay', name: 'Salary', kind: 'income', sortOrder: 1, archivedAt: null, entryCount: 0 },
    ] as LedgerCategory[];
    const entries = [
      { id: '1', date: '2026-03-01', type: 'expense', accountId: 'pkr', amount: 500, categoryId: 'food' },
      { id: '2', date: '2026-03-02', type: 'expense', accountId: 'usd', amount: 10, categoryId: 'food' },
      { id: '3', date: '2026-03-03', type: 'expense', accountId: 'pkr', amount: 4000 },
      { id: '4', date: '2026-03-04', type: 'income', accountId: 'usd', amount: 100, categoryId: 'pay' },
      { id: '5', date: '2026-03-05', type: 'transfer', accountId: 'pkr', destinationAccountId: 'usd', amount: 50 },
    ] as LedgerEntry[];

    expect(ledgerCategoryTotals({ accounts, entries }, categories)).toEqual({
      income: [{ category: 'Salary', amountPkr: 28_000 }],
      expenses: [
        { category: 'Uncategorised', amountPkr: 4000 },
        { category: 'Food', amountPkr: 3300 },
      ],
    });
  });
});

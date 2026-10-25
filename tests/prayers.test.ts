import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prayerHistory, prayers } from '@/lib/db/schema';

// Nothing touches a database: a stand-in for the query builder answers every chain and records each insert.
const historyRows: unknown[] = [];
let missed = 3;
let lastSet: object = {};

vi.mock('@/lib/db/index', () => {
  const chain = (op: string, table?: unknown) => {
    const builder = {
      from: (from: unknown) => ((table = from), builder),
      values: (values: unknown) => {
        if (table === prayerHistory) historyRows.push(values);
        if (table === prayers) missed = (values as { missed: number }).missed;
        return builder;
      },
      onConflictDoUpdate: ({ set }: { set: { missed: number } }) => ((lastSet = set), (missed = set.missed), builder),
      where: () => builder,
      orderBy: () => builder,
      limit: () => builder,
      returning: () => builder,
      then: (resolve: (rows: unknown[]) => void) =>
        resolve(table === prayerHistory && op === 'select' ? [] : [{ id: 'p', namaaz: 'fajr', missed }]),
    };
    return builder;
  };
  return {
    getDb: () => ({
      select: () => chain('select'),
      insert: (table: unknown) => chain('insert', table),
      update: (table: unknown) => chain('update', table),
      delete: (table: unknown) => chain('delete', table),
    }),
  };
});

const { setPrayer } = await import('@/lib/db/personal');
const { prayerSetSchema } = await import('@/lib/personal-validation');

beforeEach(() => {
  historyRows.length = 0;
  missed = 3;
});

describe('prayer test flag', () => {
  it('logs a real change to the prayer history', async () => {
    await setPrayer({ namaaz: 'fajr', missed: 4 });
    expect(historyRows).toHaveLength(1);
  });

  it('changes the count but writes no history for a test write', async () => {
    await setPrayer({ namaaz: 'fajr', missed: 5, test: true });
    expect(missed).toBe(5);
    expect(historyRows).toEqual([]);
  });

  it('never stores the flag on the prayer row', async () => {
    await setPrayer({ namaaz: 'fajr', missed: 6, test: true });
    expect(lastSet).toEqual({ missed: 6 });
  });

  it('accepts the flag in the API schema, defaulting to false', () => {
    expect(prayerSetSchema.parse({ namaaz: 'fajr', missed: 1, test: true })).toEqual({
      namaaz: 'fajr',
      missed: 1,
      test: true,
    });
    expect(prayerSetSchema.parse({ namaaz: 'fajr', missed: 0 }).test).toBe(false);
    expect(prayerSetSchema.safeParse({ namaaz: 'fajr', missed: 1, test: 'yes' }).success).toBe(false);
  });
});

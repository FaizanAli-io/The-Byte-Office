import { randomUUID } from 'crypto';
import { idEq } from './ids';
import { asc, desc, eq, inArray, lt, max, sql } from 'drizzle-orm';
import type { FinanceSnapshot, Holding } from '@/types/finance';
import type {
  CategoryKind,
  LedgerAccount,
  LedgerCategory,
  LedgerEntry,
  MonthlyLedger,
  MonthlyLedgerPayload,
} from '@/types/ledger';
import { getDb, getSql } from './index';
import { displayName, shapeOf } from '@/lib/accounts';
import {
  categories,
  financeSnapshots,
  holdings,
  ledgerAccounts,
  ledgerEntries,
  ledgers,
  type SnapshotHoldings,
} from './schema';

export function toSnapshotHoldings(holdings: Omit<Holding, 'id'>[]): SnapshotHoldings {
  return {
    holdings: holdings.map(({ kind, name, group, amount, exchangeRate }) => ({
      kind,
      name,
      group,
      amount,
      exchangeRate,
    })),
  };
}

function toAccount(row: typeof ledgerAccounts.$inferSelect, holding: typeof holdings.$inferSelect): LedgerAccount {
  return {
    id: row.id,
    name: displayName(holding),
    ...shapeOf(holding.kind),
    holdingId: row.holdingId,
    openingBalance: row.openingBalance,
    openingCostBasis: row.openingCostBasis ?? undefined,
    actualClosingBalance: row.actualClosingBalance ?? undefined,
    exchangeRate: row.exchangeRate,
  };
}

function toEntry(row: typeof ledgerEntries.$inferSelect): LedgerEntry {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    accountId: row.accountId,
    destinationAccountId: row.destinationAccountId ?? undefined,
    amount: row.amount,
    destinationAmount: row.destinationAmount ?? undefined,
    exchangeRate: row.exchangeRate ?? undefined,
    categoryId: row.categoryId ?? undefined,
    counterparty: row.counterparty ?? undefined,
    note: row.note ?? undefined,
  };
}

function toLedger(row: typeof ledgers.$inferSelect, accounts: LedgerAccount[], entries: LedgerEntry[]): MonthlyLedger {
  return {
    id: row.id,
    month: row.month,
    status: row.status,
    accounts,
    entries,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    finalizedAt: row.finalizedAt ?? undefined,
  };
}

export async function listLedgerSummaries() {
  return getDb()
    .select({
      month: ledgers.month,
      status: ledgers.status,
      updatedAt: ledgers.updatedAt,
    })
    .from(ledgers)
    .orderBy(desc(ledgers.month));
}

export async function loadLedger(month: string): Promise<MonthlyLedger | null> {
  const db = getDb();
  const [ledger] = await db.select().from(ledgers).where(eq(ledgers.month, month)).limit(1);
  if (!ledger) return null;

  const [accounts, entries] = await Promise.all([
    db
      .select()
      .from(ledgerAccounts)
      .innerJoin(holdings, eq(holdings.id, ledgerAccounts.holdingId))
      .where(eq(ledgerAccounts.ledgerId, ledger.id))
      .orderBy(asc(holdings.kind), asc(holdings.sortOrder)),
    db.select().from(ledgerEntries).where(eq(ledgerEntries.ledgerId, ledger.id)).orderBy(asc(ledgerEntries.sortOrder)),
  ]);

  return toLedger(
    ledger,
    accounts.map((row) => toAccount(row.ledger_accounts, row.holdings)),
    entries.map(toEntry)
  );
}

export async function loadPreviousLedger(month: string) {
  const db = getDb();
  const [ledger] = await db
    .select()
    .from(ledgers)
    .where(lt(ledgers.month, month))
    .orderBy(desc(ledgers.month))
    .limit(1);
  if (!ledger) return null;
  return loadLedger(ledger.month);
}

type Sql = ReturnType<typeof getSql>;

function insertLedgerAccount(sql: Sql, ledgerId: string, account: LedgerAccount, actualClosingBalance: number | null) {
  return sql`INSERT INTO finance.ledger_accounts (id, ledger_id, holding_id, opening_balance, opening_cost_basis, actual_closing_balance, exchange_rate)
    VALUES (${account.id}, ${ledgerId}, ${account.holdingId}, ${account.openingBalance}, ${account.openingCostBasis ?? null}, ${actualClosingBalance}, ${account.exchangeRate})`;
}

function insertLedgerEntry(sql: Sql, ledgerId: string, entry: LedgerEntry, index: number) {
  return sql`INSERT INTO finance.ledger_entries (id, ledger_id, date, type, account_id, destination_account_id, amount, destination_amount, exchange_rate, category_id, counterparty, note, sort_order)
    VALUES (${entry.id}, ${ledgerId}, ${entry.date}, ${entry.type}, ${entry.accountId}, ${entry.destinationAccountId ?? null}, ${entry.amount}, ${entry.destinationAmount ?? null}, ${entry.exchangeRate ?? null}, ${entry.categoryId ?? null}, ${entry.counterparty ?? null}, ${entry.note ?? null}, ${index})`;
}

export async function createLedger(input: { month: string; accounts: LedgerAccount[] }): Promise<MonthlyLedger> {
  const id = randomUUID();
  const now = new Date();
  const sql = getSql();
  const statements = [
    sql`INSERT INTO finance.ledgers (id, month, status, created_at, updated_at) VALUES (${id}, ${input.month}, 'draft', ${now.toISOString()}, ${now.toISOString()})`,
  ];

  input.accounts.forEach((account) => statements.push(insertLedgerAccount(sql, id, account, null)));

  await sql.transaction(statements);
  const created = await loadLedger(input.month);
  if (!created) throw new Error('Failed to create ledger');
  return created;
}

export async function saveLedger(existing: MonthlyLedger, body: MonthlyLedgerPayload): Promise<MonthlyLedger | null> {
  const now = new Date();
  const finalizedAt =
    body.status === 'finalized' ? (existing.finalizedAt ? new Date(existing.finalizedAt) : now) : null;
  const sql = getSql();
  const ledgerId = existing.id;
  const expected = new Date(body.updatedAt).toISOString();
  const kept = new Set(body.accounts.map((account) => account.id));
  const had = new Set(existing.accounts.map((account) => account.id));
  // Stale-save guard: the HTTP transaction cannot branch, so dividing by the UPDATE row count
  // aborts it with 22012 when updated_at has moved on.
  const statements = [
    sql`WITH saved AS (
      UPDATE finance.ledgers SET status = ${body.status}, updated_at = ${now.toISOString()}, finalized_at = ${finalizedAt ? finalizedAt.toISOString() : null}
      WHERE id = ${ledgerId} AND date_trunc('milliseconds', updated_at) = ${expected} RETURNING 1
    ) SELECT 1 / (SELECT count(*) FROM saved)::int`,
    ...[...had].filter((id) => !kept.has(id)).map((id) => sql`DELETE FROM finance.ledger_accounts WHERE id = ${id}`),
    ...body.accounts.map((account) =>
      had.has(account.id)
        ? sql`UPDATE finance.ledger_accounts SET opening_balance = ${account.openingBalance}, opening_cost_basis = ${account.openingCostBasis ?? null}, actual_closing_balance = ${account.actualClosingBalance ?? null}, exchange_rate = ${account.exchangeRate} WHERE id = ${account.id}`
        : insertLedgerAccount(sql, ledgerId, account, account.actualClosingBalance ?? null)
    ),
  ];

  try {
    await sql.transaction(statements);
  } catch (cause) {
    if ((cause as { code?: string }).code === '22012') return null;
    throw cause;
  }
  return loadLedger(existing.month);
}

export type EntryWrite = { kind: 'add' | 'update'; entry: LedgerEntry } | { kind: 'remove'; id: string };

// Each write bumps the month's version and is refused (22012) once the month is finalized.
export async function writeLedgerEntry(ledger: MonthlyLedger, write: EntryWrite) {
  const sql = getSql();
  const ledgerId = ledger.id;
  const bump = sql`WITH bumped AS (
    UPDATE finance.ledgers SET updated_at = ${new Date().toISOString()} WHERE id = ${ledgerId} AND status = 'draft' RETURNING 1
  ) SELECT 1 / (SELECT count(*) FROM bumped)::int`;

  let change;
  if (write.kind === 'remove') {
    change = sql`DELETE FROM finance.ledger_entries WHERE id = ${write.id} AND ledger_id = ${ledgerId}`;
  } else if (write.kind === 'add') {
    const [last] = await getDb()
      .select({ value: max(ledgerEntries.sortOrder) })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.ledgerId, ledgerId));
    change = insertLedgerEntry(sql, ledgerId, write.entry, (last.value ?? -1) + 1);
  } else {
    const entry = write.entry;
    change = sql`UPDATE finance.ledger_entries SET date = ${entry.date}, type = ${entry.type}, account_id = ${entry.accountId}, destination_account_id = ${entry.destinationAccountId ?? null}, amount = ${entry.amount}, destination_amount = ${entry.destinationAmount ?? null}, exchange_rate = ${entry.exchangeRate ?? null}, category_id = ${entry.categoryId ?? null}, counterparty = ${entry.counterparty ?? null}, note = ${entry.note ?? null}
      WHERE id = ${entry.id} AND ledger_id = ${ledgerId}`;
  }

  try {
    await sql.transaction([bump, change]);
  } catch (cause) {
    if ((cause as { code?: string }).code === '22012') return null;
    throw cause;
  }
  return loadLedger(ledger.month);
}

function toCategory(row: typeof categories.$inferSelect, entryCount = 0): LedgerCategory {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    sortOrder: row.sortOrder,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    entryCount,
  };
}

export async function listCategories(): Promise<LedgerCategory[]> {
  const rows = await getDb()
    .select({ category: categories, entryCount: sql<number>`count(${ledgerEntries.id})::int` })
    .from(categories)
    .leftJoin(ledgerEntries, eq(ledgerEntries.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return rows.map((row) => toCategory(row.category, row.entryCount));
}

export async function createCategory(input: { name: string; kind: CategoryKind }): Promise<LedgerCategory> {
  const [{ next }] = await getDb()
    .select({ next: sql<number>`coalesce(max(${categories.sortOrder}), -1) + 1` })
    .from(categories);
  const [row] = await getDb()
    .insert(categories)
    .values({ name: input.name, kind: input.kind, sortOrder: next })
    .returning();
  return toCategory(row);
}

export async function updateCategory(
  id: string,
  changes: { name?: string; kind?: CategoryKind; sortOrder?: number; archived?: boolean }
): Promise<LedgerCategory | null> {
  const [row] = await getDb()
    .update(categories)
    .set({
      ...(changes.name === undefined ? {} : { name: changes.name }),
      ...(changes.kind === undefined ? {} : { kind: changes.kind }),
      ...(changes.sortOrder === undefined ? {} : { sortOrder: changes.sortOrder }),
      ...(changes.archived === undefined ? {} : { archivedAt: changes.archived ? new Date() : null }),
    })
    .where(idEq(categories.id, id))
    .returning();
  return row ? toCategory(row) : null;
}

export async function countCategoryUses(id: string) {
  const [{ uses }] = await getDb()
    .select({ uses: sql<number>`count(*)::int` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.categoryId, id));
  return uses;
}

export async function deleteCategory(id: string) {
  const deleted = await getDb().delete(categories).where(idEq(categories.id, id)).returning({ id: categories.id });
  return deleted.length > 0;
}

export async function loadHoldMovements() {
  const rows = await getDb()
    .select({
      month: ledgers.month,
      date: ledgerEntries.date,
      type: ledgerEntries.type,
      counterparty: ledgerEntries.counterparty,
      note: ledgerEntries.note,
      amount: ledgerEntries.amount,
      entryRate: ledgerEntries.exchangeRate,
      holdingName: holdings.name,
      group: holdings.group,
      kind: holdings.kind,
      accountRate: ledgerAccounts.exchangeRate,
    })
    .from(ledgerEntries)
    .innerJoin(ledgerAccounts, eq(ledgerEntries.accountId, ledgerAccounts.id))
    .innerJoin(holdings, eq(holdings.id, ledgerAccounts.holdingId))
    .innerJoin(ledgers, eq(ledgerEntries.ledgerId, ledgers.id))
    .where(inArray(ledgerEntries.type, ['hold_received', 'hold_returned']))
    .orderBy(asc(ledgerEntries.date), asc(ledgerEntries.sortOrder));

  return rows.map((row) => {
    const { currency } = shapeOf(row.kind);
    return {
      month: row.month,
      date: row.date,
      type: row.type,
      counterparty: row.counterparty ?? undefined,
      note: row.note ?? undefined,
      account: displayName({ name: row.holdingName, group: row.group }),
      amount: row.amount,
      currency,
      amountPkr: currency === 'USD' ? row.amount * (row.entryRate ?? row.accountRate) : row.amount,
    };
  });
}

export async function listSnapshots(): Promise<FinanceSnapshot[]> {
  const rows = await getDb().select().from(financeSnapshots).orderBy(desc(financeSnapshots.timestamp)).limit(50);

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    grandTotal: row.grandTotal,
    data: row.data,
  }));
}

export async function listSnapshotSummaries() {
  const rows = await listSnapshots();
  return rows.map(({ id, timestamp, grandTotal }) => ({ id, timestamp, grandTotal }));
}

export async function getSnapshot(id: string) {
  const [row] = await getDb().select().from(financeSnapshots).where(idEq(financeSnapshots.id, id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    timestamp: row.timestamp,
    grandTotal: row.grandTotal,
    data: row.data,
  };
}

export async function createSnapshot(holdings: Omit<Holding, 'id'>[], grandTotal: number) {
  const [row] = await getDb()
    .insert(financeSnapshots)
    .values({ data: toSnapshotHoldings(holdings), grandTotal })
    .returning({ id: financeSnapshots.id });
  return row.id;
}

export async function deleteSnapshot(id: string) {
  const deleted = await getDb()
    .delete(financeSnapshots)
    .where(idEq(financeSnapshots.id, id))
    .returning({ id: financeSnapshots.id });
  return deleted.length > 0;
}

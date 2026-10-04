import { randomUUID } from 'crypto';
import { idEq } from './ids';
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { FinanceDoc, FinanceSnapshot } from '@/types/finance';
import type {
  CategoryKind,
  LedgerAccount,
  LedgerCategory,
  LedgerEntry,
  MonthlyLedger,
  MonthlyLedgerPayload,
} from '@/types/ledger';
import { getDb, getSql } from './index';
import { byAccountKind } from '@/lib/ledger';
import { categories, financeSnapshots, ledgerAccounts, ledgerEntries, ledgers, type SnapshotHoldings } from './schema';

/**
 * A snapshot records values at a point in time, so it keeps its own JSONB copy
 * of the holdings rather than pointing at live rows that can later be edited or
 * deleted. Row IDs are dropped for the same reason.
 */
export function toSnapshotHoldings(
  doc: Pick<FinanceDoc, 'name' | 'localBanks' | 'remoteBanks' | 'mutualFunds'>
): SnapshotHoldings {
  return {
    name: doc.name,
    localBanks: doc.localBanks.map(({ name, amountPkr }) => ({ name, amountPkr })),
    remoteBanks: doc.remoteBanks.map(({ name, amountUsd, exchangeRate }) => ({ name, amountUsd, exchangeRate })),
    mutualFunds: doc.mutualFunds.map((group) => {
      const bank = Object.keys(group)[0];
      return { [bank]: (group[bank] ?? []).map(({ fund, value }) => ({ fund, value })) };
    }),
  };
}

function toAccount(row: typeof ledgerAccounts.$inferSelect): LedgerAccount {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    holdingId: row.holdingId ?? undefined,
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
    _id: row.id,
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
      .where(eq(ledgerAccounts.ledgerId, ledger.id))
      .orderBy(asc(ledgerAccounts.sortOrder)),
    db.select().from(ledgerEntries).where(eq(ledgerEntries.ledgerId, ledger.id)).orderBy(asc(ledgerEntries.sortOrder)),
  ]);

  // Stable sort: within a kind, the stored order still holds.
  return toLedger(ledger, accounts.map(toAccount).sort(byAccountKind), entries.map(toEntry));
}

export async function loadPreviousFinalizedLedger(month: string) {
  const db = getDb();
  const [ledger] = await db
    .select()
    .from(ledgers)
    .where(and(eq(ledgers.status, 'finalized'), lt(ledgers.month, month)))
    .orderBy(desc(ledgers.month))
    .limit(1);
  if (!ledger) return null;
  return loadLedger(ledger.month);
}

type Sql = ReturnType<typeof getSql>;

/**
 * The column lists for the two ledger child tables, written once.
 *
 * `createLedger` and `saveLedger` both rewrite accounts, and both had their
 * own copy of a four-hundred-character INSERT — which is how a new column
 * gets added to one and forgotten in the other.
 */
function insertLedgerAccount(
  sql: Sql,
  ledgerId: string,
  account: LedgerAccount,
  index: number,
  /** A new month has no closing balance yet; a save writes what the form holds. */
  actualClosingBalance: number | null
) {
  return sql`INSERT INTO finance.ledger_accounts (id, ledger_id, holding_id, name, type, currency, opening_balance, opening_cost_basis, actual_closing_balance, exchange_rate, sort_order)
    VALUES (${account.id}, ${ledgerId}, ${account.holdingId ?? null}, ${account.name}, ${account.type}, ${account.currency}, ${account.openingBalance}, ${account.openingCostBasis ?? null}, ${actualClosingBalance}, ${account.exchangeRate}, ${index})`;
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

  input.accounts.forEach((account, index) => statements.push(insertLedgerAccount(sql, id, account, index, null)));

  await sql.transaction(statements);
  const created = await loadLedger(input.month);
  if (!created) throw new Error('Failed to create ledger');
  return created;
}

/**
 * Rewrites a month, but only if it is still the version the caller read
 * (`body.updatedAt`). Returns `null` when it is not, so two open tabs reject
 * the stale save instead of silently discarding the other one's edits.
 *
 * The HTTP transaction cannot branch, so the guard aborts it instead: the
 * conditional UPDATE runs first, and dividing by its row count raises when it
 * matched nothing. A concurrent save blocks on the row lock and then re-checks
 * `updated_at`, so the race between two saves is closed too.
 */
export async function saveLedger(existing: MonthlyLedger, body: MonthlyLedgerPayload): Promise<MonthlyLedger | null> {
  const now = new Date();
  const finalizedAt =
    body.status === 'finalized' ? (existing.finalizedAt ? new Date(existing.finalizedAt) : now) : null;
  const sql = getSql();
  const ledgerId = String(existing._id);
  const expected = new Date(body.updatedAt).toISOString();
  const statements = [
    sql`WITH saved AS (
      UPDATE finance.ledgers SET status = ${body.status}, updated_at = ${now.toISOString()}, finalized_at = ${finalizedAt ? finalizedAt.toISOString() : null}
      WHERE id = ${ledgerId} AND date_trunc('milliseconds', updated_at) = ${expected} RETURNING 1
    ) SELECT 1 / (SELECT count(*) FROM saved)::int`,
    sql`DELETE FROM finance.ledger_entries WHERE ledger_id = ${ledgerId}`,
    sql`DELETE FROM finance.ledger_accounts WHERE ledger_id = ${ledgerId}`,
  ];

  body.accounts.forEach((account, index) =>
    statements.push(insertLedgerAccount(sql, ledgerId, account, index, account.actualClosingBalance ?? null))
  );
  body.entries.forEach((entry, index) => statements.push(insertLedgerEntry(sql, ledgerId, entry, index)));

  try {
    await sql.transaction(statements);
  } catch (cause) {
    // 22012 is division_by_zero: the guard above, meaning the month moved on.
    if ((cause as { code?: string }).code === '22012') return null;
    throw cause;
  }
  const saved = await loadLedger(body.month);
  if (!saved) throw new Error('Failed to save ledger');
  return saved;
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

/**
 * Every category, archived ones included. Callers filling a picker hide the
 * archived ones themselves; callers rendering an existing entry need them, or
 * a historical category would display as a blank.
 *
 * The usage count comes from the same round trip. A left join keeps categories
 * nothing references, which are exactly the ones that can still be deleted;
 * grouping by the primary key lets the other columns come along.
 */
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

/** How many entries would break if this category went away. */
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

/**
 * Every hold movement ever recorded, oldest first, already converted to PKR.
 *
 * Holds are the one ledger figure that has to be read across months: a hold
 * taken in January is still outstanding in March, so a single month's entries
 * cannot answer what is currently being held. Draft ledgers count, because the
 * cash is in the account whether or not the month has been finalized.
 */
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
      accountName: ledgerAccounts.name,
      currency: ledgerAccounts.currency,
      accountRate: ledgerAccounts.exchangeRate,
    })
    .from(ledgerEntries)
    .innerJoin(ledgerAccounts, eq(ledgerEntries.accountId, ledgerAccounts.id))
    .innerJoin(ledgers, eq(ledgerEntries.ledgerId, ledgers.id))
    .where(inArray(ledgerEntries.type, ['hold_received', 'hold_returned']))
    .orderBy(asc(ledgerEntries.date), asc(ledgerEntries.sortOrder));

  return rows.map((row) => ({
    month: row.month,
    date: row.date,
    type: row.type,
    counterparty: row.counterparty ?? undefined,
    note: row.note ?? undefined,
    account: row.accountName,
    amount: row.amount,
    currency: row.currency,
    // The entry's own rate is the one in force when the money moved; the
    // account's is only a fallback for entries written before rates were kept.
    amountPkr: row.currency === 'USD' ? row.amount * (row.entryRate ?? row.accountRate) : row.amount,
  }));
}

export async function listSnapshots(): Promise<FinanceSnapshot[]> {
  const rows = await getDb().select().from(financeSnapshots).orderBy(desc(financeSnapshots.timestamp)).limit(50);

  return rows.map((row) => ({
    _id: row.id,
    timestamp: row.timestamp,
    grandTotal: row.grandTotal,
    data: row.data,
  }));
}

/** The same list without the holdings blob, which the assistant does not need. */
export async function listSnapshotSummaries() {
  const rows = await listSnapshots();
  return rows.map(({ _id, timestamp, grandTotal }) => ({ id: _id, timestamp, grandTotal }));
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

export async function createSnapshot(doc: Parameters<typeof toSnapshotHoldings>[0], grandTotal: number) {
  const [row] = await getDb()
    .insert(financeSnapshots)
    .values({ data: toSnapshotHoldings(doc), grandTotal })
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

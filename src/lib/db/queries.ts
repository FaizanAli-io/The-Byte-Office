import { randomUUID } from 'crypto';
import { idEq } from './ids';
import { asc, desc, eq, inArray, lt, max, sql } from 'drizzle-orm';
import type { FinanceSnapshot, SnapshotHolding } from '@/types/finance';
import type {
  CategoryKind,
  LedgerAccount,
  LedgerCategory,
  LedgerEntry,
  MonthlyLedger,
  MonthlyLedgerPayload,
} from '@/types/ledger';
import { getDb, getSql } from './index';
import { displayName, typeOf } from '@/lib/accounts';
import { ratesFor, requireRate } from '@/lib/exchange-rates';
import { PKR, type RateTable } from '@/lib/fx';
import { categories, financeSnapshots, holdings, ledgerAccounts, ledgerEntries, ledgers } from './schema';

type AccountRow = { ledger_accounts: typeof ledgerAccounts.$inferSelect; holdings: typeof holdings.$inferSelect };

// A finalized month keeps the rates frozen onto it; a draft reads the live table.
const needsLiveRate = (row: AccountRow) => row.ledger_accounts.exchangeRate === null && row.holdings.currency !== PKR;

function toAccount({ ledger_accounts: row, holdings: holding }: AccountRow, rates: RateTable): LedgerAccount {
  return {
    id: row.id,
    name: displayName(holding),
    type: typeOf(holding.kind),
    currency: holding.currency,
    holdingId: row.holdingId,
    openingBalance: row.openingBalance,
    openingCostBasis: row.openingCostBasis ?? undefined,
    actualClosingBalance: row.actualClosingBalance ?? undefined,
    exchangeRate: row.exchangeRate ?? requireRate(rates, holding.currency),
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

  const rates = await ratesFor(accounts.filter(needsLiveRate).map((row) => row.holdings.currency));
  return toLedger(
    ledger,
    accounts.map((row) => toAccount(row, rates)),
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

async function guardedTransaction(sql: Sql, statements: ReturnType<Sql>[]) {
  try {
    await sql.transaction(statements);
    return true;
  } catch (cause) {
    if ((cause as { code?: string }).code === '22012') return false;
    throw cause;
  }
}

function insertLedgerAccount(
  sql: Sql,
  ledgerId: string,
  account: LedgerAccount,
  actualClosingBalance: number | null,
  exchangeRate: number | null = null
) {
  return sql`INSERT INTO finance.ledger_accounts (id, ledger_id, holding_id, opening_balance, opening_cost_basis, actual_closing_balance, exchange_rate)
    VALUES (${account.id}, ${ledgerId}, ${account.holdingId}, ${account.openingBalance}, ${account.openingCostBasis ?? null}, ${actualClosingBalance}, ${exchangeRate})`;
}

function insertLedgerEntry(sql: Sql, ledgerId: string, entry: LedgerEntry, index: number) {
  return sql`INSERT INTO finance.ledger_entries (id, ledger_id, date, type, account_id, destination_account_id, amount, destination_amount, exchange_rate, category_id, counterparty, note, sort_order)
    VALUES (${entry.id}, ${ledgerId}, ${entry.date}, ${entry.type}, ${entry.accountId}, ${entry.destinationAccountId ?? null}, ${entry.amount}, ${entry.destinationAmount ?? null}, ${entry.exchangeRate ?? null}, ${entry.categoryId ?? null}, ${entry.counterparty ?? null}, ${entry.note ?? null}, ${index})`;
}

function updateLedgerEntry(sql: Sql, ledgerId: string, entry: LedgerEntry) {
  return sql`UPDATE finance.ledger_entries SET date = ${entry.date}, type = ${entry.type}, account_id = ${entry.accountId}, destination_account_id = ${entry.destinationAccountId ?? null}, amount = ${entry.amount}, destination_amount = ${entry.destinationAmount ?? null}, exchange_rate = ${entry.exchangeRate ?? null}, category_id = ${entry.categoryId ?? null}, counterparty = ${entry.counterparty ?? null}, note = ${entry.note ?? null}
    WHERE id = ${entry.id} AND ledger_id = ${ledgerId}`;
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

// Finalizing freezes the given live rates onto the month's accounts; a draft stores none.
export async function saveLedger(
  existing: MonthlyLedger,
  body: MonthlyLedgerPayload,
  rates: RateTable = {}
): Promise<MonthlyLedger | null> {
  const now = new Date();
  const finalizedAt =
    body.status === 'finalized' ? (existing.finalizedAt ? new Date(existing.finalizedAt) : now) : null;
  const sql = getSql();
  const ledgerId = existing.id;
  const expected = new Date(body.updatedAt).toISOString();
  const frozen = (account: LedgerAccount) =>
    body.status === 'finalized' ? requireRate(rates, account.currency) : null;
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
        ? sql`UPDATE finance.ledger_accounts SET opening_balance = ${account.openingBalance}, opening_cost_basis = ${account.openingCostBasis ?? null}, actual_closing_balance = ${account.actualClosingBalance ?? null}, exchange_rate = ${frozen(account)} WHERE id = ${account.id}`
        : insertLedgerAccount(sql, ledgerId, account, account.actualClosingBalance ?? null, frozen(account))
    ),
  ];

  return (await guardedTransaction(sql, statements)) ? loadLedger(existing.month) : null;
}

export type EntryChanges = { insert: LedgerEntry[]; update: LedgerEntry[]; remove: string[] };

// One transaction per change set, so a transfer and the cost or gain split from it are never partly written. Each
// write bumps the month's version and is refused (22012) once the month is finalized.
export async function writeLedgerEntries(ledger: MonthlyLedger, changes: EntryChanges) {
  const sql = getSql();
  const ledgerId = ledger.id;
  const bump = sql`WITH bumped AS (
    UPDATE finance.ledgers SET updated_at = ${new Date().toISOString()} WHERE id = ${ledgerId} AND status = 'draft' RETURNING 1
  ) SELECT 1 / (SELECT count(*) FROM bumped)::int`;

  let next = 0;
  if (changes.insert.length) {
    const [last] = await getDb()
      .select({ value: max(ledgerEntries.sortOrder) })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.ledgerId, ledgerId));
    next = (last.value ?? -1) + 1;
  }
  const statements = [
    bump,
    ...changes.remove.map((id) => sql`DELETE FROM finance.ledger_entries WHERE id = ${id} AND ledger_id = ${ledgerId}`),
    ...changes.update.map((entry) => updateLedgerEntry(sql, ledgerId, entry)),
    ...changes.insert.map((entry, index) => insertLedgerEntry(sql, ledgerId, entry, next + index)),
  ];
  return (await guardedTransaction(sql, statements)) ? loadLedger(ledger.month) : null;
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

// Created on first use; the unique name index makes concurrent first uses converge on one row.
export async function ensureCategory(input: { name: string; kind: CategoryKind }) {
  const db = getDb();
  await db
    .insert(categories)
    .values({ ...input, sortOrder: sql`(SELECT coalesce(max(sort_order), -1) + 1 FROM finance.categories)` })
    .onConflictDoNothing();
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(sql`lower(${categories.name}) = ${input.name.toLowerCase()}`)
    .limit(1);
  return row.id;
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
      currency: holdings.currency,
      accountRate: ledgerAccounts.exchangeRate,
    })
    .from(ledgerEntries)
    .innerJoin(ledgerAccounts, eq(ledgerEntries.accountId, ledgerAccounts.id))
    .innerJoin(holdings, eq(holdings.id, ledgerAccounts.holdingId))
    .innerJoin(ledgers, eq(ledgerEntries.ledgerId, ledgers.id))
    .where(inArray(ledgerEntries.type, ['hold_received', 'hold_returned']))
    .orderBy(asc(ledgerEntries.date), asc(ledgerEntries.sortOrder));

  const rates = await ratesFor(rows.filter((row) => row.entryRate === null).map((row) => row.currency));
  return rows.map((row) => ({
    month: row.month,
    date: row.date,
    type: row.type,
    counterparty: row.counterparty ?? undefined,
    note: row.note ?? undefined,
    account: displayName({ name: row.holdingName, group: row.group }),
    amount: row.amount,
    currency: row.currency,
    amountPkr: row.amount * (row.entryRate ?? row.accountRate ?? requireRate(rates, row.currency)),
  }));
}

export async function listSnapshots(): Promise<FinanceSnapshot[]> {
  return getDb().select().from(financeSnapshots).orderBy(desc(financeSnapshots.timestamp)).limit(50);
}

export async function listSnapshotSummaries() {
  const rows = await listSnapshots();
  return rows.map(({ id, timestamp, grandTotal }) => ({ id, timestamp, grandTotal }));
}

export async function getSnapshot(id: string): Promise<FinanceSnapshot | null> {
  const [row] = await getDb().select().from(financeSnapshots).where(idEq(financeSnapshots.id, id)).limit(1);
  return row ?? null;
}

export async function createSnapshot(holdings: SnapshotHolding[], grandTotal: number) {
  const data = holdings.map(({ kind, name, group, currency, amount, exchangeRate }) => ({
    kind,
    name,
    group,
    currency,
    amount,
    exchangeRate,
  }));
  const [row] = await getDb()
    .insert(financeSnapshots)
    .values({ data: { holdings: data }, grandTotal })
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

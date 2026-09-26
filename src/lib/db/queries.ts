import { randomUUID } from 'crypto';
import { and, asc, desc, eq, lt } from 'drizzle-orm';
import type { FinanceDoc, FinanceFund, FinanceSnapshot } from '@/types/finance';
import type { LedgerAccount, LedgerEntry, MonthlyLedger, MonthlyLedgerPayload } from '@/types/ledger';
import { getDb, getSql } from './index';
import {
  financeSnapshots,
  ledgerAccounts,
  ledgerEntries,
  ledgers,
  localBanks,
  mutualFunds,
  remoteBanks,
  type SnapshotHoldings,
} from './schema';

const MUTUAL_FUND_GROUP_STRIDE = 1000;

export function flattenMutualFunds(groups: FinanceDoc['mutualFunds']) {
  return groups.flatMap((group, groupIndex) => {
    const bankName = Object.keys(group)[0] ?? '';
    return (group[bankName] ?? []).map((fund, fundIndex) => ({
      id: fund.id,
      bankName,
      fundName: fund.fund,
      value: fund.value,
      sortOrder: groupIndex * MUTUAL_FUND_GROUP_STRIDE + fundIndex,
    }));
  });
}

export function groupMutualFunds(
  rows: { id?: string; bankName: string; fundName: string; value: number; sortOrder: number }[]
): FinanceDoc['mutualFunds'] {
  const groups = new Map<number, { bankName: string; funds: FinanceFund[] }>();

  for (const row of [...rows].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const groupIndex = Math.floor(row.sortOrder / MUTUAL_FUND_GROUP_STRIDE);
    const group = groups.get(groupIndex) ?? { bankName: row.bankName, funds: [] };
    group.funds.push({ id: row.id, fund: row.fundName, value: row.value });
    groups.set(groupIndex, group);
  }

  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, group]) => ({ [group.bankName]: group.funds }));
}

export async function loadFinanceDoc(): Promise<FinanceDoc> {
  const db = getDb();
  const [local, remote, funds] = await Promise.all([
    db.select().from(localBanks).orderBy(asc(localBanks.sortOrder)),
    db.select().from(remoteBanks).orderBy(asc(remoteBanks.sortOrder)),
    db.select().from(mutualFunds).orderBy(asc(mutualFunds.sortOrder)),
  ]);

  return {
    name: 'finance',
    localBanks: local.map((bank) => ({
      id: bank.id,
      name: bank.name,
      amountPkr: bank.amountPkr,
    })),
    remoteBanks: remote.map((bank) => ({
      id: bank.id,
      name: bank.name,
      amountUsd: bank.amountUsd,
      exchangeRate: bank.exchangeRate,
    })),
    mutualFunds: groupMutualFunds(funds),
  };
}

/**
 * Saves the portfolio as a diff against the current rows rather than replacing
 * the table.
 *
 * Holding IDs are the stable handles the finance agent proposes actions
 * against (`portfolio_item_update` / `portfolio_item_remove` look items up by
 * ID and compare a content fingerprint). Truncating and reinserting rotated
 * every UUID on every save, so any proposal created before a save failed on
 * confirmation. Rows that arrive with a known ID are updated in place, rows
 * without one are inserted, and rows the editor dropped are deleted.
 *
 * An unrecognised ID is treated as an insert instead of an error so that a
 * stale editor tab degrades to creating a duplicate rather than failing the
 * whole save.
 */
export async function saveFinanceDoc(doc: Omit<FinanceDoc, '_id'>): Promise<FinanceDoc> {
  const sql = getSql();
  const db = getDb();

  const [existingLocal, existingRemote, existingFunds] = await Promise.all([
    db.select({ id: localBanks.id }).from(localBanks),
    db.select({ id: remoteBanks.id }).from(remoteBanks),
    db.select({ id: mutualFunds.id }).from(mutualFunds),
  ]);

  const localIds = new Set(existingLocal.map((row) => row.id));
  const remoteIds = new Set(existingRemote.map((row) => row.id));
  const fundIds = new Set(existingFunds.map((row) => row.id));

  const keptLocal = new Set<string>();
  const keptRemote = new Set<string>();
  const keptFunds = new Set<string>();
  const statements: ReturnType<typeof sql>[] = [];

  doc.localBanks.forEach((bank, index) => {
    if (bank.id && localIds.has(bank.id)) {
      keptLocal.add(bank.id);
      statements.push(
        sql`UPDATE finance.local_banks SET name = ${bank.name}, amount_pkr = ${bank.amountPkr}, sort_order = ${index}, updated_at = now() WHERE id = ${bank.id}`
      );
      return;
    }
    statements.push(
      sql`INSERT INTO finance.local_banks (name, amount_pkr, sort_order) VALUES (${bank.name}, ${bank.amountPkr}, ${index})`
    );
  });

  doc.remoteBanks.forEach((bank, index) => {
    if (bank.id && remoteIds.has(bank.id)) {
      keptRemote.add(bank.id);
      statements.push(
        sql`UPDATE finance.remote_banks SET name = ${bank.name}, amount_usd = ${bank.amountUsd}, exchange_rate = ${bank.exchangeRate}, sort_order = ${index}, updated_at = now() WHERE id = ${bank.id}`
      );
      return;
    }
    statements.push(
      sql`INSERT INTO finance.remote_banks (name, amount_usd, exchange_rate, sort_order) VALUES (${bank.name}, ${bank.amountUsd}, ${bank.exchangeRate}, ${index})`
    );
  });

  flattenMutualFunds(doc.mutualFunds).forEach((fund) => {
    if (fund.id && fundIds.has(fund.id)) {
      keptFunds.add(fund.id);
      statements.push(
        sql`UPDATE finance.mutual_funds SET bank_name = ${fund.bankName}, fund_name = ${fund.fundName}, value = ${fund.value}, sort_order = ${fund.sortOrder}, updated_at = now() WHERE id = ${fund.id}`
      );
      return;
    }
    statements.push(
      sql`INSERT INTO finance.mutual_funds (bank_name, fund_name, value, sort_order) VALUES (${fund.bankName}, ${fund.fundName}, ${fund.value}, ${fund.sortOrder})`
    );
  });

  for (const id of localIds) {
    if (!keptLocal.has(id)) statements.push(sql`DELETE FROM finance.local_banks WHERE id = ${id}`);
  }
  for (const id of remoteIds) {
    if (!keptRemote.has(id)) statements.push(sql`DELETE FROM finance.remote_banks WHERE id = ${id}`);
  }
  for (const id of fundIds) {
    if (!keptFunds.has(id)) statements.push(sql`DELETE FROM finance.mutual_funds WHERE id = ${id}`);
  }

  if (statements.length) await sql.transaction(statements);
  return loadFinanceDoc();
}

function toAccount(row: typeof ledgerAccounts.$inferSelect): LedgerAccount {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
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
    category: row.category ?? undefined,
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

  return toLedger(ledger, accounts.map(toAccount), entries.map(toEntry));
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

export async function createLedger(input: { month: string; accounts: LedgerAccount[] }): Promise<MonthlyLedger> {
  const id = randomUUID();
  const now = new Date();
  const sql = getSql();
  const statements = [
    sql`INSERT INTO finance.ledgers (id, month, status, created_at, updated_at) VALUES (${id}, ${input.month}, 'draft', ${now.toISOString()}, ${now.toISOString()})`,
  ];

  input.accounts.forEach((account, index) => {
    statements.push(
      sql`INSERT INTO finance.ledger_accounts (id, ledger_id, name, type, currency, opening_balance, opening_cost_basis, actual_closing_balance, exchange_rate, sort_order) VALUES (${account.id}, ${id}, ${account.name}, ${account.type}, ${account.currency}, ${account.openingBalance}, ${account.openingCostBasis ?? null}, ${null}, ${account.exchangeRate}, ${index})`
    );
  });

  await sql.transaction(statements);
  const created = await loadLedger(input.month);
  if (!created) throw new Error('Failed to create ledger');
  return created;
}

export async function saveLedger(existing: MonthlyLedger, body: MonthlyLedgerPayload): Promise<MonthlyLedger> {
  const now = new Date();
  const finalizedAt =
    body.status === 'finalized' ? (existing.finalizedAt ? new Date(existing.finalizedAt) : now) : null;
  const sql = getSql();
  const ledgerId = String(existing._id);
  const statements = [
    sql`DELETE FROM finance.ledger_entries WHERE ledger_id = ${ledgerId}`,
    sql`DELETE FROM finance.ledger_accounts WHERE ledger_id = ${ledgerId}`,
    sql`UPDATE finance.ledgers SET status = ${body.status}, updated_at = ${now.toISOString()}, finalized_at = ${finalizedAt ? finalizedAt.toISOString() : null} WHERE id = ${ledgerId}`,
  ];

  body.accounts.forEach((account, index) => {
    statements.push(
      sql`INSERT INTO finance.ledger_accounts (id, ledger_id, name, type, currency, opening_balance, opening_cost_basis, actual_closing_balance, exchange_rate, sort_order) VALUES (${account.id}, ${ledgerId}, ${account.name}, ${account.type}, ${account.currency}, ${account.openingBalance}, ${account.openingCostBasis ?? null}, ${account.actualClosingBalance ?? null}, ${account.exchangeRate}, ${index})`
    );
  });
  body.entries.forEach((entry, index) => {
    statements.push(
      sql`INSERT INTO finance.ledger_entries (id, ledger_id, date, type, account_id, destination_account_id, amount, destination_amount, exchange_rate, category, note, sort_order) VALUES (${entry.id}, ${ledgerId}, ${entry.date}, ${entry.type}, ${entry.accountId}, ${entry.destinationAccountId ?? null}, ${entry.amount}, ${entry.destinationAmount ?? null}, ${entry.exchangeRate ?? null}, ${entry.category ?? null}, ${entry.note ?? null}, ${index})`
    );
  });

  await sql.transaction(statements);
  const saved = await loadLedger(body.month);
  if (!saved) throw new Error('Failed to save ledger');
  return saved;
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

export async function createSnapshot(data: SnapshotHoldings, grandTotal: number) {
  const [row] = await getDb()
    .insert(financeSnapshots)
    .values({ data, grandTotal })
    .returning({ id: financeSnapshots.id });
  return row.id;
}

export async function deleteSnapshot(id: string) {
  const deleted = await getDb()
    .delete(financeSnapshots)
    .where(eq(financeSnapshots.id, id))
    .returning({ id: financeSnapshots.id });
  return deleted.length > 0;
}

import { randomUUID } from 'crypto';
import { and, asc, desc, eq, lt } from 'drizzle-orm';
import type { FinanceDoc, FinanceFund, FinanceSnapshot } from '@/types/finance';
import type { LedgerAccount, LedgerEntry, MonthlyLedger, MonthlyLedgerPayload } from '@/types/ledger';
import { parseMinor, serializeMinor, toMajor, toMinor, type Minor } from '@/lib/money';
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

/**
 * Snapshots store their holdings as a JSONB copy in major units, and rows
 * written before the move to minor units are still in that form. Keeping the
 * blob decimal means old snapshots keep reading correctly and the document
 * stays human-inspectable; it is converted at this boundary like any other
 * stored decimal.
 */
function snapshotToMinor(data: SnapshotHoldings): FinanceDoc {
  return {
    name: data.name,
    localBanks: data.localBanks.map((bank) => ({ name: bank.name, amountPkr: toMinor(bank.amountPkr) })),
    remoteBanks: data.remoteBanks.map((bank) => ({
      name: bank.name,
      amountUsd: toMinor(bank.amountUsd),
      exchangeRate: bank.exchangeRate,
    })),
    mutualFunds: data.mutualFunds.map((group) => {
      const bank = Object.keys(group)[0];
      return { [bank]: (group[bank] ?? []).map((fund) => ({ fund: fund.fund, value: toMinor(fund.value) })) };
    }),
  };
}

export function snapshotToMajor(doc: Pick<FinanceDoc, 'name' | 'localBanks' | 'remoteBanks' | 'mutualFunds'>) {
  return {
    name: doc.name,
    localBanks: doc.localBanks.map((bank) => ({ name: bank.name, amountPkr: toMajor(bank.amountPkr) })),
    remoteBanks: doc.remoteBanks.map((bank) => ({
      name: bank.name,
      amountUsd: toMajor(bank.amountUsd),
      exchangeRate: bank.exchangeRate,
    })),
    mutualFunds: doc.mutualFunds.map((group) => {
      const bank = Object.keys(group)[0];
      return { [bank]: (group[bank] ?? []).map((fund) => ({ fund: fund.fund, value: toMajor(fund.value) })) };
    }),
  } satisfies SnapshotHoldings;
}

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

/** Takes rows whose `value` is already in minor units, as `loadHoldings` returns them. */
export function groupMutualFunds(
  rows: { id?: string; bankName: string; fundName: string; value: Minor; sortOrder: number }[]
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

/**
 * The three holding tables as raw rows, in display order.
 *
 * Both shapes the app needs are derived from this: `loadFinanceDoc` groups it
 * for the editor and the snapshot format, while the assistant's
 * `portfolio_get` serves the flat rows. They used to be two separate reads of
 * the same three tables in two different modules.
 */
export async function loadHoldings() {
  const db = getDb();
  const [localBankRows, remoteBankRows, mutualFundRows] = await Promise.all([
    db.select().from(localBanks).orderBy(asc(localBanks.sortOrder)),
    db.select().from(remoteBanks).orderBy(asc(remoteBanks.sortOrder)),
    db.select().from(mutualFunds).orderBy(asc(mutualFunds.sortOrder)),
  ]);

  // Amounts become minor units here so nothing downstream ever sees the raw
  // decimal string or has to remember to convert it.
  return {
    localBanks: localBankRows.map((row) => ({ ...row, amountPkr: parseMinor(row.amountPkr) })),
    remoteBanks: remoteBankRows.map((row) => ({ ...row, amountUsd: parseMinor(row.amountUsd) })),
    mutualFunds: mutualFundRows.map((row) => ({ ...row, value: parseMinor(row.value) })),
  };
}

export async function loadFinanceDoc(): Promise<FinanceDoc> {
  const { localBanks: local, remoteBanks: remote, mutualFunds: funds } = await loadHoldings();

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
        sql`UPDATE finance.local_banks SET name = ${bank.name}, amount_pkr = ${serializeMinor(bank.amountPkr)}, sort_order = ${index}, updated_at = now() WHERE id = ${bank.id}`
      );
      return;
    }
    statements.push(
      sql`INSERT INTO finance.local_banks (name, amount_pkr, sort_order) VALUES (${bank.name}, ${serializeMinor(bank.amountPkr)}, ${index})`
    );
  });

  doc.remoteBanks.forEach((bank, index) => {
    if (bank.id && remoteIds.has(bank.id)) {
      keptRemote.add(bank.id);
      statements.push(
        sql`UPDATE finance.remote_banks SET name = ${bank.name}, amount_usd = ${serializeMinor(bank.amountUsd)}, exchange_rate = ${bank.exchangeRate}, sort_order = ${index}, updated_at = now() WHERE id = ${bank.id}`
      );
      return;
    }
    statements.push(
      sql`INSERT INTO finance.remote_banks (name, amount_usd, exchange_rate, sort_order) VALUES (${bank.name}, ${serializeMinor(bank.amountUsd)}, ${bank.exchangeRate}, ${index})`
    );
  });

  flattenMutualFunds(doc.mutualFunds).forEach((fund) => {
    if (fund.id && fundIds.has(fund.id)) {
      keptFunds.add(fund.id);
      statements.push(
        sql`UPDATE finance.mutual_funds SET bank_name = ${fund.bankName}, fund_name = ${fund.fundName}, value = ${serializeMinor(fund.value)}, sort_order = ${fund.sortOrder}, updated_at = now() WHERE id = ${fund.id}`
      );
      return;
    }
    statements.push(
      sql`INSERT INTO finance.mutual_funds (bank_name, fund_name, value, sort_order) VALUES (${fund.bankName}, ${fund.fundName}, ${serializeMinor(fund.value)}, ${fund.sortOrder})`
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
    openingBalance: parseMinor(row.openingBalance),
    openingCostBasis: row.openingCostBasis === null ? undefined : parseMinor(row.openingCostBasis),
    actualClosingBalance: row.actualClosingBalance === null ? undefined : parseMinor(row.actualClosingBalance),
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
    amount: parseMinor(row.amount),
    destinationAmount: row.destinationAmount === null ? undefined : parseMinor(row.destinationAmount),
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
      sql`INSERT INTO finance.ledger_accounts (id, ledger_id, name, type, currency, opening_balance, opening_cost_basis, actual_closing_balance, exchange_rate, sort_order) VALUES (${account.id}, ${id}, ${account.name}, ${account.type}, ${account.currency}, ${serializeMinor(account.openingBalance)}, ${account.openingCostBasis === undefined ? null : serializeMinor(account.openingCostBasis)}, ${null}, ${account.exchangeRate}, ${index})`
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
      sql`INSERT INTO finance.ledger_accounts (id, ledger_id, name, type, currency, opening_balance, opening_cost_basis, actual_closing_balance, exchange_rate, sort_order) VALUES (${account.id}, ${ledgerId}, ${account.name}, ${account.type}, ${account.currency}, ${serializeMinor(account.openingBalance)}, ${account.openingCostBasis === undefined ? null : serializeMinor(account.openingCostBasis)}, ${account.actualClosingBalance === undefined ? null : serializeMinor(account.actualClosingBalance)}, ${account.exchangeRate}, ${index})`
    );
  });
  body.entries.forEach((entry, index) => {
    statements.push(
      sql`INSERT INTO finance.ledger_entries (id, ledger_id, date, type, account_id, destination_account_id, amount, destination_amount, exchange_rate, category, note, sort_order) VALUES (${entry.id}, ${ledgerId}, ${entry.date}, ${entry.type}, ${entry.accountId}, ${entry.destinationAccountId ?? null}, ${serializeMinor(entry.amount)}, ${entry.destinationAmount === undefined ? null : serializeMinor(entry.destinationAmount)}, ${entry.exchangeRate ?? null}, ${entry.category ?? null}, ${entry.note ?? null}, ${index})`
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
    grandTotal: parseMinor(row.grandTotal),
    data: snapshotToMinor(row.data),
  }));
}

/** The same list without the holdings blob, which the assistant does not need. */
export async function listSnapshotSummaries() {
  const rows = await listSnapshots();
  return rows.map(({ _id, timestamp, grandTotal }) => ({ id: _id, timestamp, grandTotal }));
}

export async function getSnapshot(id: string) {
  const [row] = await getDb().select().from(financeSnapshots).where(eq(financeSnapshots.id, id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    timestamp: row.timestamp,
    grandTotal: parseMinor(row.grandTotal),
    data: snapshotToMinor(row.data),
  };
}

export async function createSnapshot(doc: Parameters<typeof snapshotToMajor>[0], grandTotal: Minor) {
  const [row] = await getDb()
    .insert(financeSnapshots)
    .values({ data: snapshotToMajor(doc), grandTotal: serializeMinor(grandTotal) })
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

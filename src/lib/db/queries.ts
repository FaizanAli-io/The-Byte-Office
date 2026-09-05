import { randomUUID } from "crypto";
import { and, asc, desc, eq, lt } from "drizzle-orm";
import type { FinanceDoc, FinanceSnapshot } from "@/types/finance";
import type {
  LedgerAccount,
  LedgerEntry,
  MonthlyLedger,
  MonthlyLedgerPayload,
} from "@/types/ledger";
import { getDb, getSql } from "./index";
import {
  financeSnapshots,
  ledgerAccounts,
  ledgerEntries,
  ledgers,
  localBanks,
  mutualFunds,
  remoteBanks,
  type SnapshotHoldings,
} from "./schema";

const MUTUAL_FUND_GROUP_STRIDE = 1000;

export function flattenMutualFunds(groups: FinanceDoc["mutualFunds"]) {
  return groups.flatMap((group, groupIndex) => {
    const bankName = Object.keys(group)[0] ?? "";
    return (group[bankName] ?? []).map((fund, fundIndex) => ({
      bankName,
      fundName: fund.fund,
      value: fund.value,
      sortOrder: groupIndex * MUTUAL_FUND_GROUP_STRIDE + fundIndex,
    }));
  });
}

export function groupMutualFunds(
  rows: { bankName: string; fundName: string; value: number; sortOrder: number }[],
): FinanceDoc["mutualFunds"] {
  const groups = new Map<
    number,
    { bankName: string; funds: { fund: string; value: number }[] }
  >();

  for (const row of [...rows].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const groupIndex = Math.floor(row.sortOrder / MUTUAL_FUND_GROUP_STRIDE);
    const group = groups.get(groupIndex) ?? { bankName: row.bankName, funds: [] };
    group.funds.push({ fund: row.fundName, value: row.value });
    groups.set(groupIndex, group);
  }

  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, group]) => ({ [group.bankName]: group.funds }));
}

export async function loadFinanceDoc(): Promise<FinanceDoc> {
  const db = getDb();
  const [local, remote, funds] = await Promise.all([
    db.select().from(localBanks).orderBy(asc(localBanks.sortOrder)),
    db.select().from(remoteBanks).orderBy(asc(remoteBanks.sortOrder)),
    db.select().from(mutualFunds).orderBy(asc(mutualFunds.sortOrder)),
  ]);

  return {
    name: "finance",
    localBanks: local.map((bank) => ({
      name: bank.name,
      amountPkr: bank.amountPkr,
    })),
    remoteBanks: remote.map((bank) => ({
      name: bank.name,
      amountUsd: bank.amountUsd,
      exchangeRate: bank.exchangeRate,
    })),
    mutualFunds: groupMutualFunds(funds),
  };
}

export async function saveFinanceDoc(doc: Omit<FinanceDoc, "_id">) {
  const sql = getSql();
  const statements = [
    sql`DELETE FROM local_banks`,
    sql`DELETE FROM remote_banks`,
    sql`DELETE FROM mutual_funds`,
  ];

  doc.localBanks.forEach((bank, index) => {
    statements.push(
      sql`INSERT INTO local_banks (name, amount_pkr, sort_order) VALUES (${bank.name}, ${bank.amountPkr}, ${index})`,
    );
  });
  doc.remoteBanks.forEach((bank, index) => {
    statements.push(
      sql`INSERT INTO remote_banks (name, amount_usd, exchange_rate, sort_order) VALUES (${bank.name}, ${bank.amountUsd}, ${bank.exchangeRate}, ${index})`,
    );
  });
  flattenMutualFunds(doc.mutualFunds).forEach((fund) => {
    statements.push(
      sql`INSERT INTO mutual_funds (bank_name, fund_name, value, sort_order) VALUES (${fund.bankName}, ${fund.fundName}, ${fund.value}, ${fund.sortOrder})`,
    );
  });

  await sql.transaction(statements);
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

function toLedger(
  row: typeof ledgers.$inferSelect,
  accounts: LedgerAccount[],
  entries: LedgerEntry[],
): MonthlyLedger {
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
  const [ledger] = await db
    .select()
    .from(ledgers)
    .where(eq(ledgers.month, month))
    .limit(1);
  if (!ledger) return null;

  const [accounts, entries] = await Promise.all([
    db
      .select()
      .from(ledgerAccounts)
      .where(eq(ledgerAccounts.ledgerId, ledger.id))
      .orderBy(asc(ledgerAccounts.sortOrder)),
    db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.ledgerId, ledger.id))
      .orderBy(asc(ledgerEntries.sortOrder)),
  ]);

  return toLedger(ledger, accounts.map(toAccount), entries.map(toEntry));
}

export async function loadPreviousFinalizedLedger(month: string) {
  const db = getDb();
  const [ledger] = await db
    .select()
    .from(ledgers)
    .where(and(eq(ledgers.status, "finalized"), lt(ledgers.month, month)))
    .orderBy(desc(ledgers.month))
    .limit(1);
  if (!ledger) return null;
  return loadLedger(ledger.month);
}

export async function createLedger(input: {
  month: string;
  accounts: LedgerAccount[];
}): Promise<MonthlyLedger> {
  const id = randomUUID();
  const now = new Date();
  const sql = getSql();
  const statements = [
    sql`INSERT INTO ledgers (id, month, status, created_at, updated_at) VALUES (${id}, ${input.month}, 'draft', ${now.toISOString()}, ${now.toISOString()})`,
  ];

  input.accounts.forEach((account, index) => {
    statements.push(
      sql`INSERT INTO ledger_accounts (id, ledger_id, name, type, currency, opening_balance, opening_cost_basis, actual_closing_balance, exchange_rate, sort_order) VALUES (${account.id}, ${id}, ${account.name}, ${account.type}, ${account.currency}, ${account.openingBalance}, ${account.openingCostBasis ?? null}, ${null}, ${account.exchangeRate}, ${index})`,
    );
  });

  await sql.transaction(statements);
  const created = await loadLedger(input.month);
  if (!created) throw new Error("Failed to create ledger");
  return created;
}

export async function saveLedger(
  existing: MonthlyLedger,
  body: MonthlyLedgerPayload,
): Promise<MonthlyLedger> {
  const now = new Date();
  const finalizedAt =
    body.status === "finalized"
      ? existing.finalizedAt
        ? new Date(existing.finalizedAt)
        : now
      : null;
  const sql = getSql();
  const ledgerId = String(existing._id);
  const statements = [
    sql`DELETE FROM ledger_entries WHERE ledger_id = ${ledgerId}`,
    sql`DELETE FROM ledger_accounts WHERE ledger_id = ${ledgerId}`,
    sql`UPDATE ledgers SET status = ${body.status}, updated_at = ${now.toISOString()}, finalized_at = ${finalizedAt ? finalizedAt.toISOString() : null} WHERE id = ${ledgerId}`,
  ];

  body.accounts.forEach((account, index) => {
    statements.push(
      sql`INSERT INTO ledger_accounts (id, ledger_id, name, type, currency, opening_balance, opening_cost_basis, actual_closing_balance, exchange_rate, sort_order) VALUES (${account.id}, ${ledgerId}, ${account.name}, ${account.type}, ${account.currency}, ${account.openingBalance}, ${account.openingCostBasis ?? null}, ${account.actualClosingBalance ?? null}, ${account.exchangeRate}, ${index})`,
    );
  });
  body.entries.forEach((entry, index) => {
    statements.push(
      sql`INSERT INTO ledger_entries (id, ledger_id, date, type, account_id, destination_account_id, amount, destination_amount, exchange_rate, category, note, sort_order) VALUES (${entry.id}, ${ledgerId}, ${entry.date}, ${entry.type}, ${entry.accountId}, ${entry.destinationAccountId ?? null}, ${entry.amount}, ${entry.destinationAmount ?? null}, ${entry.exchangeRate ?? null}, ${entry.category ?? null}, ${entry.note ?? null}, ${index})`,
    );
  });

  await sql.transaction(statements);
  const saved = await loadLedger(body.month);
  if (!saved) throw new Error("Failed to save ledger");
  return saved;
}

export async function listSnapshots(): Promise<FinanceSnapshot[]> {
  const rows = await getDb()
    .select()
    .from(financeSnapshots)
    .orderBy(desc(financeSnapshots.timestamp))
    .limit(50);

  return rows.map((row) => ({
    _id: row.id,
    timestamp: row.timestamp,
    grandTotal: row.grandTotal,
    data: row.data,
  }));
}

export async function createSnapshot(
  data: SnapshotHoldings,
  grandTotal: number,
) {
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

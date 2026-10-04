import { asc, max } from 'drizzle-orm';
import { idEq } from './ids';
import { getDb, getSql } from './index';
import { localBanks, mutualFunds, remoteBanks } from './schema';
import type { FinanceDoc, FinanceFund } from '@/types/finance';
import type { PortfolioItemInput, PortfolioItemType } from '@/lib/agent/types';
import { FUND_SEPARATOR, type Holding, type HoldingChanges } from '@/lib/portfolio-sync';

/**
 * Every read and write of the three holding tables: the editor's grouped
 * document, the assistant's per-item CRUD, and the flat `Holding` view the
 * ledger sync works in.
 */

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

  return { localBanks: localBankRows, remoteBanks: remoteBankRows, mutualFunds: mutualFundRows };
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

/**
 * Each holding type is its own table, and every operation below used to repeat
 * the same three-way branch. The map collapses that to one lookup; the casts
 * are the price of addressing three differently-shaped tables through one
 * code path, and the column sets are already validated upstream by
 * `parsePortfolioItem` / `parsePortfolioUpdate`.
 */
const HOLDING_TABLES = {
  local_bank: localBanks,
  remote_bank: remoteBanks,
  mutual_fund: mutualFunds,
} as const;

type HoldingTable = (typeof HOLDING_TABLES)[PortfolioItemType];

function holdingTable(itemType: PortfolioItemType): HoldingTable {
  return HOLDING_TABLES[itemType];
}

export async function getPortfolioItem(itemType: PortfolioItemType, id: string) {
  const table = holdingTable(itemType);
  const row = (await getDb().select().from(table).where(idEq(table.id, id)).limit(1))[0];
  return row ?? null;
}

/** `id` is passed when the ledger sync has already linked an account to the new holding. */
export async function addPortfolioItem(item: PortfolioItemInput, id?: string) {
  const { itemType, ...values } = item;
  const table = holdingTable(itemType);
  const [created] = await getDb()
    .insert(table)
    .values({ ...values, ...(id ? { id } : {}), sortOrder: await nextSortOrder(item) } as never)
    .returning();
  return created;
}

/**
 * Banks append. A fund joins its bank's group, or opens a new one: appending
 * by plain max would file it under whichever bank happens to be last.
 */
async function nextSortOrder(item: PortfolioItemInput) {
  const db = getDb();
  if (item.itemType !== 'mutual_fund') {
    const table = holdingTable(item.itemType);
    const [order] = await db.select({ value: max(table.sortOrder) }).from(table);
    return (order.value ?? -1) + 1;
  }
  const rows = await db.select({ bankName: mutualFunds.bankName, sortOrder: mutualFunds.sortOrder }).from(mutualFunds);
  const sameBank = rows.filter((row) => row.bankName === item.bankName).map((row) => row.sortOrder);
  if (sameBank.length) return Math.max(...sameBank) + 1;
  const last = Math.max(-1, ...rows.map((row) => row.sortOrder));
  return last < 0 ? 0 : (Math.floor(last / MUTUAL_FUND_GROUP_STRIDE) + 1) * MUTUAL_FUND_GROUP_STRIDE;
}

export async function updatePortfolioItem(itemType: PortfolioItemType, id: string, changes: Record<string, unknown>) {
  const table = holdingTable(itemType);
  const [row] = await getDb()
    .update(table)
    .set({ ...changes, updatedAt: new Date() } as never)
    .where(idEq(table.id, id))
    .returning();
  return row ?? null;
}

export async function removePortfolioItem(itemType: PortfolioItemType, id: string) {
  const table = holdingTable(itemType);
  return getDb().delete(table).where(idEq(table.id, id)).returning({ id: table.id });
}

/** Every holding in the flat shape the ledger sync works in. */
export async function loadHoldingList(): Promise<Holding[]> {
  const rows = await loadHoldings();
  return [
    ...rows.localBanks.map((row) => ({
      id: row.id,
      kind: 'local_bank' as const,
      name: row.name,
      amount: row.amountPkr,
      exchangeRate: 1,
    })),
    ...rows.remoteBanks.map((row) => ({
      id: row.id,
      kind: 'remote_bank' as const,
      name: row.name,
      amount: row.amountUsd,
      exchangeRate: row.exchangeRate,
    })),
    ...rows.mutualFunds.map((row) => ({
      id: row.id,
      kind: 'mutual_fund' as const,
      name: `${row.bankName}${FUND_SEPARATOR}${row.fundName}`,
      amount: row.value,
      exchangeRate: 1,
    })),
  ];
}

function holdingFields(holding: Holding): PortfolioItemInput {
  if (holding.kind === 'local_bank') return { itemType: 'local_bank', name: holding.name, amountPkr: holding.amount };
  if (holding.kind === 'remote_bank') {
    return {
      itemType: 'remote_bank',
      name: holding.name,
      amountUsd: holding.amount,
      exchangeRate: holding.exchangeRate,
    };
  }
  // A fund account named without the separator files under a bank of the same name.
  const [bankName, ...rest] = holding.name.split(FUND_SEPARATOR);
  return { itemType: 'mutual_fund', bankName, fundName: rest.join(FUND_SEPARATOR) || bankName, value: holding.amount };
}

export async function applyHoldingChanges({ create, update, remove }: HoldingChanges) {
  for (const holding of create) await addPortfolioItem(holdingFields(holding), holding.id);
  for (const holding of update) {
    const { itemType, ...fields } = holdingFields(holding);
    await updatePortfolioItem(itemType, holding.id, fields);
  }
  for (const holding of remove) await removePortfolioItem(holding.kind, holding.id);
}

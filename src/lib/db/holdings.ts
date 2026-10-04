import { and, asc, eq, max } from 'drizzle-orm';
import { idEq } from './ids';
import { getDb, getSql } from './index';
import { holdings } from './schema';
import type { FinanceDoc, FinanceFund } from '@/types/finance';
import type { PortfolioItemInput, PortfolioItemType } from '@/lib/agent/types';
import { FUND_SEPARATOR, type Holding, type HoldingChanges } from '@/lib/portfolio-sync';

/**
 * Every read and write of the `holdings` table, in the three shapes callers
 * want: the editor's grouped document, the assistant's per-kind items, and the
 * flat `Holding` the ledger sync works in. The API still speaks in local
 * banks, remote banks and mutual funds; only storage became one table.
 */

type HoldingRow = typeof holdings.$inferSelect;
type HoldingValues = Pick<HoldingRow, 'kind' | 'name' | 'groupName' | 'amount' | 'exchangeRate'>;
type RowInput = HoldingValues & { id?: string; sortOrder: number };

/** The editor's document as rows, each kind in its own display order. */
export function docToRows(doc: Pick<FinanceDoc, 'localBanks' | 'remoteBanks' | 'mutualFunds'>): RowInput[] {
  const funds = doc.mutualFunds.flatMap((group) => {
    const bank = Object.keys(group)[0] ?? '';
    return (group[bank] ?? []).map((fund) => ({ id: fund.id, name: fund.fund, groupName: bank, amount: fund.value }));
  });
  return [
    ...doc.localBanks.map((bank, index) => ({
      id: bank.id,
      kind: 'local_bank' as const,
      name: bank.name,
      groupName: null,
      amount: bank.amountPkr,
      exchangeRate: 1,
      sortOrder: index,
    })),
    ...doc.remoteBanks.map((bank, index) => ({
      id: bank.id,
      kind: 'remote_bank' as const,
      name: bank.name,
      groupName: null,
      amount: bank.amountUsd,
      exchangeRate: bank.exchangeRate,
      sortOrder: index,
    })),
    ...funds.map((fund, index) => ({ ...fund, kind: 'mutual_fund' as const, exchangeRate: 1, sortOrder: index })),
  ];
}

/** Rows as the editor's document. Funds group by bank, banks in the order they first appear. */
export function rowsToDoc(rows: RowInput[]): FinanceDoc {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  const ofKind = (kind: HoldingRow['kind']) => sorted.filter((row) => row.kind === kind);
  const groups = new Map<string, FinanceFund[]>();
  for (const row of ofKind('mutual_fund')) {
    const bank = row.groupName ?? '';
    groups.set(bank, [...(groups.get(bank) ?? []), { id: row.id, fund: row.name, value: row.amount }]);
  }
  return {
    name: 'finance',
    localBanks: ofKind('local_bank').map((row) => ({ id: row.id, name: row.name, amountPkr: row.amount })),
    remoteBanks: ofKind('remote_bank').map((row) => ({
      id: row.id,
      name: row.name,
      amountUsd: row.amount,
      exchangeRate: row.exchangeRate,
    })),
    mutualFunds: [...groups].map(([bank, funds]) => ({ [bank]: funds })),
  };
}

/** Rows in the per-kind shapes the assistant's items and `portfolio_get` have always used. */
const meta = (row: HoldingRow) => ({ sortOrder: row.sortOrder, createdAt: row.createdAt, updatedAt: row.updatedAt });
const localItem = (row: HoldingRow) => ({ id: row.id, name: row.name, amountPkr: row.amount, ...meta(row) });
const remoteItem = (row: HoldingRow) => ({
  id: row.id,
  name: row.name,
  amountUsd: row.amount,
  exchangeRate: row.exchangeRate,
  ...meta(row),
});
const fundItem = (row: HoldingRow) => ({
  id: row.id,
  bankName: row.groupName ?? '',
  fundName: row.name,
  value: row.amount,
  ...meta(row),
});
const ITEM_SHAPES = { local_bank: localItem, remote_bank: remoteItem, mutual_fund: fundItem };
const toItem = (row: HoldingRow) => ITEM_SHAPES[row.kind](row);

function itemValues(item: PortfolioItemInput): HoldingValues {
  if (item.itemType === 'local_bank') {
    return { kind: item.itemType, name: item.name, groupName: null, amount: item.amountPkr, exchangeRate: 1 };
  }
  if (item.itemType === 'remote_bank') {
    return {
      kind: item.itemType,
      name: item.name,
      groupName: null,
      amount: item.amountUsd,
      exchangeRate: item.exchangeRate,
    };
  }
  return { kind: item.itemType, name: item.fundName, groupName: item.bankName, amount: item.value, exchangeRate: 1 };
}

/** Per-kind field names (`amountPkr`, `bankName`, …) to columns, for partial updates. */
const ITEM_COLUMNS: Record<string, keyof HoldingValues> = {
  amountPkr: 'amount',
  amountUsd: 'amount',
  value: 'amount',
  exchangeRate: 'exchangeRate',
  bankName: 'groupName',
  fundName: 'name',
  name: 'name',
};

/** Kinds in their declared order (local, remote, funds), each in its own sort order. */
async function loadRows() {
  return getDb().select().from(holdings).orderBy(asc(holdings.kind), asc(holdings.sortOrder));
}

async function nextSortOrder(kind: HoldingRow['kind']) {
  const [order] = await getDb()
    .select({ value: max(holdings.sortOrder) })
    .from(holdings)
    .where(eq(holdings.kind, kind));
  return (order.value ?? -1) + 1;
}

/** Holdings split by kind, as `portfolio_get` serves them. */
export async function loadHoldings() {
  const rows = await loadRows();
  const ofKind = (kind: HoldingRow['kind']) => rows.filter((row) => row.kind === kind);
  return {
    localBanks: ofKind('local_bank').map(localItem),
    remoteBanks: ofKind('remote_bank').map(remoteItem),
    mutualFunds: ofKind('mutual_fund').map(fundItem),
  };
}

export async function loadFinanceDoc(): Promise<FinanceDoc> {
  return rowsToDoc(await loadRows());
}

/**
 * Saves the editor's document as a diff against the stored rows: known ids
 * update in place, new rows insert, rows the editor dropped are deleted.
 *
 * Ids have to survive a save — the assistant's proposals and the ledger's
 * account links point at them. An unrecognised id inserts rather than fails,
 * so a stale editor tab degrades to a duplicate instead of a lost save.
 */
export async function saveFinanceDoc(doc: Omit<FinanceDoc, '_id'>): Promise<FinanceDoc> {
  const sql = getSql();
  const existing = new Set((await getDb().select({ id: holdings.id }).from(holdings)).map((row) => row.id));
  const kept = new Set<string>();

  const statements = docToRows(doc).map((row) => {
    if (row.id && existing.has(row.id)) {
      kept.add(row.id);
      return sql`UPDATE finance.holdings SET kind = ${row.kind}, name = ${row.name}, group_name = ${row.groupName}, amount = ${row.amount}, exchange_rate = ${row.exchangeRate}, sort_order = ${row.sortOrder}, updated_at = now() WHERE id = ${row.id}`;
    }
    return sql`INSERT INTO finance.holdings (kind, name, group_name, amount, exchange_rate, sort_order) VALUES (${row.kind}, ${row.name}, ${row.groupName}, ${row.amount}, ${row.exchangeRate}, ${row.sortOrder})`;
  });
  for (const id of existing) {
    if (!kept.has(id)) statements.push(sql`DELETE FROM finance.holdings WHERE id = ${id}`);
  }

  if (statements.length) await sql.transaction(statements);
  return loadFinanceDoc();
}

const byKindAndId = (itemType: PortfolioItemType, id: string) =>
  and(idEq(holdings.id, id), eq(holdings.kind, itemType));

export async function getPortfolioItem(itemType: PortfolioItemType, id: string) {
  const [row] = await getDb().select().from(holdings).where(byKindAndId(itemType, id)).limit(1);
  return row ? toItem(row) : null;
}

/** `id` is passed when the ledger sync has already linked an account to the new holding. */
export async function addPortfolioItem(item: PortfolioItemInput, id?: string) {
  const values = itemValues(item);
  const [row] = await getDb()
    .insert(holdings)
    .values({ ...values, ...(id ? { id } : {}), sortOrder: await nextSortOrder(values.kind) })
    .returning();
  return toItem(row);
}

export async function updatePortfolioItem(itemType: PortfolioItemType, id: string, changes: Record<string, unknown>) {
  const set = Object.fromEntries(
    Object.entries(changes).flatMap(([key, value]) => (ITEM_COLUMNS[key] ? [[ITEM_COLUMNS[key], value]] : []))
  );
  const [row] = await getDb()
    .update(holdings)
    .set({ ...set, updatedAt: new Date() })
    .where(byKindAndId(itemType, id))
    .returning();
  return row ? toItem(row) : null;
}

export async function removePortfolioItem(itemType: PortfolioItemType, id: string) {
  return getDb().delete(holdings).where(byKindAndId(itemType, id)).returning({ id: holdings.id });
}

/** Every holding in the flat shape the ledger sync works in; a fund reads "Bank · Fund". */
export async function loadHoldingList(): Promise<Holding[]> {
  return (await loadRows()).map((row) => ({
    id: row.id,
    kind: row.kind,
    name: row.groupName === null ? row.name : `${row.groupName}${FUND_SEPARATOR}${row.name}`,
    amount: row.amount,
    exchangeRate: row.exchangeRate,
  }));
}

function holdingValues(holding: Holding): HoldingValues {
  if (holding.kind !== 'mutual_fund') {
    const exchangeRate = holding.kind === 'remote_bank' ? holding.exchangeRate : 1;
    return { kind: holding.kind, name: holding.name, groupName: null, amount: holding.amount, exchangeRate };
  }
  // A fund account named without the separator files under a bank of the same name.
  const [bank, ...rest] = holding.name.split(FUND_SEPARATOR);
  return {
    kind: holding.kind,
    name: rest.join(FUND_SEPARATOR) || bank,
    groupName: bank,
    amount: holding.amount,
    exchangeRate: 1,
  };
}

export async function applyHoldingChanges({ create, update, remove }: HoldingChanges) {
  const db = getDb();
  for (const holding of create) {
    const values = holdingValues(holding);
    await db.insert(holdings).values({ ...values, id: holding.id, sortOrder: await nextSortOrder(values.kind) });
  }
  for (const holding of update) {
    await db
      .update(holdings)
      .set({ ...holdingValues(holding), updatedAt: new Date() })
      .where(idEq(holdings.id, holding.id));
  }
  for (const holding of remove) await db.delete(holdings).where(idEq(holdings.id, holding.id));
}

import { eq, max } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { localBanks, mutualFunds, remoteBanks } from '@/lib/db/schema';
import type { PortfolioItemInput, PortfolioItemType } from '@/lib/agent/types';

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
  const row = (await getDb().select().from(table).where(eq(table.id, id)).limit(1))[0];
  return row ?? null;
}

export async function addPortfolioItem(item: PortfolioItemInput) {
  const db = getDb();
  const { itemType, ...values } = item;
  const table = holdingTable(itemType);
  const [order] = await db.select({ value: max(table.sortOrder) }).from(table);
  const [created] = await db
    .insert(table)
    .values({ ...values, sortOrder: (order.value ?? -1) + 1 } as never)
    .returning();
  return created;
}

export async function updatePortfolioItem(itemType: PortfolioItemType, id: string, changes: Record<string, unknown>) {
  const table = holdingTable(itemType);
  const [row] = await getDb()
    .update(table)
    .set({ ...changes, updatedAt: new Date() } as never)
    .where(eq(table.id, id))
    .returning();
  return row ?? null;
}

export async function removePortfolioItem(itemType: PortfolioItemType, id: string) {
  const table = holdingTable(itemType);
  return getDb().delete(table).where(eq(table.id, id)).returning({ id: table.id });
}

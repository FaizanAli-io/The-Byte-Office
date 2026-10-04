import { asc, eq, inArray, isNull, max } from 'drizzle-orm';
import { getDb } from './index';
import { holdings } from './schema';
import type { HoldingIdentity } from '@/lib/accounts';
import type { HoldingKind } from '@/types/finance';

export type HoldingRow = typeof holdings.$inferSelect;
export type IdentityUpdate = { id: string } & Partial<Pick<HoldingRow, 'name' | 'group' | 'sortOrder'>>;

export async function loadActiveHoldings() {
  return getDb()
    .select()
    .from(holdings)
    .where(isNull(holdings.archivedAt))
    .orderBy(asc(holdings.kind), asc(holdings.sortOrder));
}

export async function insertHoldings(created: (HoldingIdentity & { archived?: boolean; sortOrder?: number })[]) {
  const next = new Map<HoldingKind, number>();
  for (const holding of created) {
    if (!next.has(holding.kind)) {
      const [order] = await getDb()
        .select({ value: max(holdings.sortOrder) })
        .from(holdings)
        .where(eq(holdings.kind, holding.kind));
      next.set(holding.kind, (order.value ?? -1) + 1);
    }
    const sortOrder = holding.sortOrder ?? next.get(holding.kind)!;
    next.set(holding.kind, Math.max(next.get(holding.kind)!, sortOrder + 1));
    await getDb()
      .insert(holdings)
      .values({
        id: holding.id,
        kind: holding.kind,
        name: holding.name,
        group: holding.group,
        sortOrder,
        archivedAt: holding.archived ? new Date() : null,
      });
  }
}

export async function updateHoldingIdentities(updated: IdentityUpdate[]) {
  for (const { id, ...fields } of updated) {
    await getDb()
      .update(holdings)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(holdings.id, id));
  }
}

export async function archiveHoldings(ids: string[]) {
  if (ids.length) await getDb().update(holdings).set({ archivedAt: new Date() }).where(inArray(holdings.id, ids));
}

export async function deleteHoldings(ids: string[]) {
  if (ids.length) await getDb().delete(holdings).where(inArray(holdings.id, ids));
}

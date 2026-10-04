import { asc, eq, inArray, isNull, max } from 'drizzle-orm';
import { getDb } from './index';
import { holdings } from './schema';
import type { FinanceDoc, FinanceFund } from '@/types/finance';
import type { HoldingIdentity, HoldingKind, HoldingValue } from '@/lib/accounts';

export type HoldingRow = typeof holdings.$inferSelect;

type DocRow = Omit<HoldingIdentity, 'id'> & HoldingValue & { id?: string; sortOrder: number };

export function docToRows(doc: Pick<FinanceDoc, 'localBanks' | 'remoteBanks' | 'mutualFunds'>): DocRow[] {
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

export function rowsToDoc(rows: DocRow[]): FinanceDoc {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  const ofKind = (kind: HoldingKind) => sorted.filter((row) => row.kind === kind);
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
        groupName: holding.groupName,
        sortOrder,
        archivedAt: holding.archived ? new Date() : null,
      });
  }
}

export async function updateHoldingIdentities(
  updated: ({ id: string } & Partial<Pick<HoldingRow, 'name' | 'groupName' | 'sortOrder'>>)[]
) {
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

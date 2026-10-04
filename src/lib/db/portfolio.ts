import { randomUUID } from 'crypto';
import {
  archiveHoldings,
  deleteHoldings,
  docToRows,
  insertHoldings,
  loadActiveHoldings,
  rowsToDoc,
  updateHoldingIdentities,
  type HoldingRow,
} from './holdings';
import { createLedger, createSnapshot, listLedgerSummaries, loadLedger, saveLedger } from './queries';
import {
  accountsForNewMonth,
  planLedgerHoldings,
  planPortfolioAccounts,
  valuesFrom,
  type HoldingIdentity,
  type HoldingValue,
  type PortfolioChange,
} from '@/lib/accounts';
import { portfolioTotals } from '@/lib/finance';
import { currentMonth, nextMonth } from '@/lib/ledger';
import type { PortfolioItemInput, PortfolioItemType } from '@/lib/agent/types';
import type { FinanceDoc } from '@/types/finance';
import type { MonthlyLedger, MonthlyLedgerPayload } from '@/types/ledger';

type IdentityUpdate = { id: string } & Partial<Pick<HoldingRow, 'name' | 'groupName' | 'sortOrder'>>;
type PortfolioRow = HoldingValue & { row: HoldingRow };

const identity = (row: HoldingRow): HoldingIdentity => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  groupName: row.groupName,
});

const differs = (a: number, b: number) => Math.abs(a - b) >= 0.005;

async function newestLedger() {
  const [newest] = await listLedgerSummaries();
  return newest ? loadLedger(newest.month) : null;
}

async function loadPortfolio(): Promise<PortfolioRow[]> {
  const [rows, ledger] = await Promise.all([loadActiveHoldings(), newestLedger()]);
  const values = valuesFrom(ledger);
  return rows.map((row) => ({ row, ...(values.get(row.id) ?? { amount: 0, exchangeRate: 1 }) }));
}

export async function loadFinanceDoc(): Promise<FinanceDoc> {
  return rowsToDoc(
    (await loadPortfolio()).map(({ row, amount, exchangeRate }) => ({
      ...identity(row),
      amount,
      exchangeRate,
      sortOrder: row.sortOrder,
    }))
  );
}

const meta = ({ row }: PortfolioRow) => ({
  sortOrder: row.sortOrder,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
const localItem = (p: PortfolioRow) => ({ id: p.row.id, name: p.row.name, amountPkr: p.amount, ...meta(p) });
const remoteItem = (p: PortfolioRow) => ({
  id: p.row.id,
  name: p.row.name,
  amountUsd: p.amount,
  exchangeRate: p.exchangeRate,
  ...meta(p),
});
const fundItem = (p: PortfolioRow) => ({
  id: p.row.id,
  bankName: p.row.groupName ?? '',
  fundName: p.row.name,
  value: p.amount,
  ...meta(p),
});
const ITEM_SHAPES = { local_bank: localItem, remote_bank: remoteItem, mutual_fund: fundItem };

export async function loadHoldings() {
  const portfolio = await loadPortfolio();
  const ofKind = (kind: HoldingRow['kind']) => portfolio.filter((p) => p.row.kind === kind);
  return {
    localBanks: ofKind('local_bank').map(localItem),
    remoteBanks: ofKind('remote_bank').map(remoteItem),
    mutualFunds: ofKind('mutual_fund').map(fundItem),
  };
}

export async function getPortfolioItem(itemType: PortfolioItemType, id: string) {
  const found = (await loadPortfolio()).find((p) => p.row.id === id && p.row.kind === itemType);
  return found ? ITEM_SHAPES[itemType](found) : null;
}

export async function loadHoldingIdentities() {
  return (await loadActiveHoldings()).map(identity);
}

async function targetLedger(): Promise<MonthlyLedger> {
  const [newest] = await listLedgerSummaries();
  if (newest?.status === 'draft') return (await loadLedger(newest.month))!;
  const previous = newest ? await loadLedger(newest.month) : null;
  return createLedger({
    month: newest ? nextMonth(newest.month) : currentMonth(),
    accounts: accountsForNewMonth(await loadHoldingIdentities(), previous),
  });
}

async function applyPortfolioChange(change: PortfolioChange, identities: IdentityUpdate[] = []) {
  await updateHoldingIdentities(identities);
  if (!change.create.length && !change.update.length && !change.archive.length) return;

  // The month is fetched before new holdings exist, or a freshly opened month would already include them.
  let ledger = await targetLedger();
  await insertHoldings(change.create.map(({ holding }) => holding));
  await archiveHoldings(change.archive);
  for (let attempt = 0; attempt < 2; attempt++) {
    if (await saveLedger(ledger, { ...ledger, accounts: planPortfolioAccounts(ledger, change) })) return;
    ledger = (await loadLedger(ledger.month))!;
  }
  throw new Error(`The ${ledger.month} ledger kept changing while saving the portfolio. Try again.`);
}

export async function saveFinanceDoc(doc: Omit<FinanceDoc, '_id'>) {
  const current = new Map((await loadPortfolio()).map((p) => [p.row.id, p]));
  const change: PortfolioChange = { create: [], update: [], archive: [] };
  const identities: IdentityUpdate[] = [];
  const seen = new Set<string>();

  for (const row of docToRows(doc)) {
    const existing = row.id && !seen.has(row.id) ? current.get(row.id) : undefined;
    if (!existing) {
      const holding = {
        id: randomUUID(),
        kind: row.kind,
        name: row.name,
        groupName: row.groupName,
        sortOrder: row.sortOrder,
      };
      change.create.push({ holding, value: { amount: row.amount, exchangeRate: row.exchangeRate } });
      continue;
    }
    seen.add(existing.row.id);
    const { name, groupName, sortOrder } = existing.row;
    if (name !== row.name || groupName !== row.groupName || sortOrder !== row.sortOrder) {
      identities.push({ id: existing.row.id, name: row.name, groupName: row.groupName, sortOrder: row.sortOrder });
    }
    const value: Partial<HoldingValue> = {
      ...(differs(existing.amount, row.amount) ? { amount: row.amount } : {}),
      ...(row.kind === 'remote_bank' && differs(existing.exchangeRate, row.exchangeRate)
        ? { exchangeRate: row.exchangeRate }
        : {}),
    };
    if (Object.keys(value).length) change.update.push({ id: existing.row.id, value });
  }
  for (const id of current.keys()) if (!seen.has(id)) change.archive.push(id);

  await applyPortfolioChange(change, identities);
  return loadFinanceDoc();
}

function itemParts(item: PortfolioItemInput): { holding: HoldingIdentity; value: HoldingValue } {
  const id = randomUUID();
  if (item.itemType === 'local_bank') {
    return {
      holding: { id, kind: item.itemType, name: item.name, groupName: null },
      value: { amount: item.amountPkr, exchangeRate: 1 },
    };
  }
  if (item.itemType === 'remote_bank') {
    return {
      holding: { id, kind: item.itemType, name: item.name, groupName: null },
      value: { amount: item.amountUsd, exchangeRate: item.exchangeRate },
    };
  }
  return {
    holding: { id, kind: item.itemType, name: item.fundName, groupName: item.bankName },
    value: { amount: item.value, exchangeRate: 1 },
  };
}

export async function addPortfolioItem(item: PortfolioItemInput) {
  const created = itemParts(item);
  await applyPortfolioChange({ create: [created], update: [], archive: [] });
  return getPortfolioItem(item.itemType, created.holding.id);
}

export async function updatePortfolioItem(itemType: PortfolioItemType, id: string, changes: Record<string, unknown>) {
  const name = (itemType === 'mutual_fund' ? changes.fundName : changes.name) as string | undefined;
  const groupName = itemType === 'mutual_fund' ? (changes.bankName as string | undefined) : undefined;
  const amount = (changes.amountPkr ?? changes.amountUsd ?? changes.value) as number | undefined;
  const exchangeRate = itemType === 'remote_bank' ? (changes.exchangeRate as number | undefined) : undefined;
  const value = {
    ...(amount === undefined ? {} : { amount }),
    ...(exchangeRate === undefined ? {} : { exchangeRate }),
  };
  const identities = name !== undefined || groupName !== undefined ? [{ id, name, groupName }] : [];
  await applyPortfolioChange(
    { create: [], update: Object.keys(value).length ? [{ id, value }] : [], archive: [] },
    identities
  );
  return getPortfolioItem(itemType, id);
}

export async function removePortfolioItem(itemType: PortfolioItemType, id: string) {
  if (!(await getPortfolioItem(itemType, id))) return [];
  await applyPortfolioChange({ create: [], update: [], archive: [id] });
  return [{ id }];
}

// holding_id is a foreign key: holdings are created before the ledger save and rolled back if it fails.
export async function saveLedgerSynced(existing: MonthlyLedger, body: MonthlyLedgerPayload) {
  const [newest] = await listLedgerSummaries();
  const plan = planLedgerHoldings(existing, body, body.month === newest?.month);

  await insertHoldings(plan.create);
  const saved = await saveLedger(existing, { ...body, accounts: plan.accounts });
  if (!saved) {
    await deleteHoldings(plan.create.map((holding) => holding.id));
    return null;
  }
  await updateHoldingIdentities(plan.rename.map(({ id, name, groupName }) => ({ id, name, groupName })));
  await archiveHoldings(plan.archive);

  if (existing.status === 'draft' && saved.status === 'finalized') {
    const portfolio = await loadFinanceDoc();
    await createSnapshot(portfolio, portfolioTotals(portfolio).grandTotal);
  }
  return plan.rename.length ? loadLedger(body.month) : saved;
}

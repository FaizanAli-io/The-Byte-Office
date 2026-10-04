import { randomUUID } from 'crypto';
import {
  archiveHoldings,
  deleteHoldings,
  insertHoldings,
  loadActiveHoldings,
  updateHoldingIdentities,
  type HoldingRow,
  type IdentityUpdate,
} from './holdings';
import { createLedger, createSnapshot, listLedgerSummaries, loadLedger, saveLedger } from './queries';
import {
  accountsForNewMonth,
  differs,
  planLedgerHoldings,
  planPortfolioAccounts,
  valuesFrom,
  type HoldingIdentity,
  type HoldingValue,
  type PortfolioChange,
} from '@/lib/accounts';
import { portfolioTotals } from '@/lib/finance';
import { currentMonth, nextMonth } from '@/lib/ledger';
import type { Holding } from '@/types/finance';
import type { MonthlyLedger, MonthlyLedgerPayload } from '@/types/ledger';

type PortfolioRow = HoldingValue & { row: HoldingRow };

const identity = (row: HoldingRow): HoldingIdentity => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  group: row.group,
});

async function newestLedger() {
  const [newest] = await listLedgerSummaries();
  return newest ? loadLedger(newest.month) : null;
}

const rateFor = (holding: Pick<Holding, 'kind' | 'exchangeRate'>) =>
  holding.kind === 'remote_bank' ? holding.exchangeRate : 1;

async function loadPortfolio(): Promise<PortfolioRow[]> {
  const [rows, ledger] = await Promise.all([loadActiveHoldings(), newestLedger()]);
  const values = valuesFrom(ledger);
  return rows.map((row) => ({ row, ...(values.get(row.id) ?? { amount: 0, exchangeRate: 1 }) }));
}

export async function loadPortfolioHoldings(): Promise<Holding[]> {
  return (await loadPortfolio()).map(({ row, amount, exchangeRate }) => ({
    ...identity(row),
    amount,
    exchangeRate: rateFor({ kind: row.kind, exchangeRate }),
  }));
}

export async function getHolding(id: string) {
  return (await loadPortfolioHoldings()).find((holding) => holding.id === id) ?? null;
}

export async function loadHoldingIdentities() {
  return (await loadActiveHoldings()).map(identity);
}

async function targetLedger(): Promise<MonthlyLedger> {
  const newest = await newestLedger();
  if (newest?.status === 'draft') return newest;
  return createLedger({
    month: newest ? nextMonth(newest.month) : currentMonth(),
    accounts: accountsForNewMonth(await loadHoldingIdentities(), newest),
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

export async function savePortfolio(next: Holding[]) {
  const current = new Map((await loadPortfolio()).map((p) => [p.row.id, p]));
  const change: PortfolioChange = { create: [], update: [], archive: [] };
  const identities: IdentityUpdate[] = [];
  const seen = new Set<string>();
  const position = new Map<string, number>();

  for (const holding of next) {
    const sortOrder = position.get(holding.kind) ?? 0;
    position.set(holding.kind, sortOrder + 1);
    const existing = holding.id && !seen.has(holding.id) ? current.get(holding.id) : undefined;
    if (!existing) {
      change.create.push({
        holding: { id: randomUUID(), kind: holding.kind, name: holding.name, group: holding.group, sortOrder },
        value: { amount: holding.amount, exchangeRate: rateFor(holding) },
      });
      continue;
    }
    seen.add(existing.row.id);
    const { name, group } = existing.row;
    if (name !== holding.name || group !== holding.group || existing.row.sortOrder !== sortOrder) {
      identities.push({ id: existing.row.id, name: holding.name, group: holding.group, sortOrder });
    }
    const value: Partial<HoldingValue> = {
      ...(differs(existing.amount, holding.amount) ? { amount: holding.amount } : {}),
      ...(holding.kind === 'remote_bank' && differs(existing.exchangeRate, holding.exchangeRate)
        ? { exchangeRate: holding.exchangeRate }
        : {}),
    };
    if (Object.keys(value).length) change.update.push({ id: existing.row.id, value });
  }
  for (const id of current.keys()) if (!seen.has(id)) change.archive.push(id);

  await applyPortfolioChange(change, identities);
  return loadPortfolioHoldings();
}

export async function addHolding(input: Omit<Holding, 'id'>) {
  const holding = { id: randomUUID(), kind: input.kind, name: input.name, group: input.group };
  await applyPortfolioChange({
    create: [{ holding, value: { amount: input.amount, exchangeRate: rateFor(input) } }],
    update: [],
    archive: [],
  });
  return getHolding(holding.id);
}

export async function updateHolding(id: string, changes: Partial<Omit<Holding, 'id' | 'kind'>>) {
  const current = await getHolding(id);
  if (!current) return null;
  const { name, group, amount, exchangeRate } = changes;
  const value = {
    ...(amount === undefined ? {} : { amount }),
    ...(exchangeRate === undefined || current.kind !== 'remote_bank' ? {} : { exchangeRate }),
  };
  const identities = name !== undefined || group !== undefined ? [{ id, name, group }] : [];
  await applyPortfolioChange(
    { create: [], update: Object.keys(value).length ? [{ id, value }] : [], archive: [] },
    identities
  );
  return getHolding(id);
}

export async function removeHolding(id: string) {
  if (!(await getHolding(id))) return false;
  await applyPortfolioChange({ create: [], update: [], archive: [id] });
  return true;
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
  await updateHoldingIdentities(plan.rename.map(({ id, name, group }) => ({ id, name, group })));
  await archiveHoldings(plan.archive);

  if (existing.status === 'draft' && saved.status === 'finalized') {
    const holdings = await loadPortfolioHoldings();
    await createSnapshot(holdings, portfolioTotals(holdings).grandTotal);
    const month = nextMonth(saved.month);
    if (!(await loadLedger(month))) {
      await createLedger({ month, accounts: accountsForNewMonth(await loadHoldingIdentities(), saved) });
    }
  }
  return plan.rename.length ? loadLedger(body.month) : saved;
}

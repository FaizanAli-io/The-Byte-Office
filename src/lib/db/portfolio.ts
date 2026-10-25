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
import { assertSupportedCurrencies, ratesFor, requireRate } from '@/lib/exchange-rates';
import { portfolioTotals } from '@/lib/finance';
import { currentMonth, nextMonth } from '@/lib/ledger';
import type { Holding, HoldingInput } from '@/types/finance';
import type { MonthlyLedger, MonthlyLedgerPayload } from '@/types/ledger';

type PortfolioRow = HoldingValue & { row: HoldingRow };

const identity = (row: HoldingRow): HoldingIdentity => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  group: row.group,
  currency: row.currency,
});

async function newestLedger() {
  const [newest] = await listLedgerSummaries();
  return newest ? loadLedger(newest.month) : null;
}

async function loadPortfolio(): Promise<PortfolioRow[]> {
  const [rows, ledger] = await Promise.all([loadActiveHoldings(), newestLedger()]);
  const values = valuesFrom(ledger);
  return rows.map((row) => ({ row, ...(values.get(row.id) ?? { amount: 0 }) }));
}

// The portfolio is always valued at live rates.
export async function priceHoldings<T extends Omit<Holding, 'exchangeRate'>>(holdings: T[]) {
  const rates = await ratesFor(holdings.map((holding) => holding.currency));
  return holdings.map((holding) => ({ ...holding, exchangeRate: requireRate(rates, holding.currency, holding.name) }));
}

export async function loadPortfolioHoldings(): Promise<Holding[]> {
  return priceHoldings((await loadPortfolio()).map(({ row, amount }) => ({ ...identity(row), amount })));
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

export async function savePortfolio(next: HoldingInput[]) {
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
        holding: { id: randomUUID(), ...identityOf(holding), sortOrder },
        value: { amount: holding.amount },
      });
      continue;
    }
    seen.add(existing.row.id);
    const { name, group } = existing.row;
    if (name !== holding.name || group !== holding.group || existing.row.sortOrder !== sortOrder) {
      identities.push({ id: existing.row.id, name: holding.name, group: holding.group, sortOrder });
    }
    if (differs(existing.amount, holding.amount))
      change.update.push({ id: existing.row.id, value: { amount: holding.amount } });
  }
  for (const id of current.keys()) if (!seen.has(id)) change.archive.push(id);

  await assertSupportedCurrencies(change.create.map(({ holding }) => holding));
  await applyPortfolioChange(change, identities);
  return loadPortfolioHoldings();
}

const identityOf = ({ kind, name, group, currency }: Omit<HoldingInput, 'id' | 'amount'>) => ({
  kind,
  name,
  group,
  currency,
});

export async function addHolding(input: Omit<HoldingInput, 'id'>) {
  const create = [{ holding: { id: randomUUID(), ...identityOf(input) }, value: { amount: input.amount } }];
  await assertSupportedCurrencies([input]);
  await applyPortfolioChange({ create, update: [], archive: [] });
  return getHolding(create[0].holding.id);
}

// A holding's kind and currency are fixed once it exists: past months were valued in that currency.
export async function updateHolding(id: string, changes: Partial<Pick<HoldingInput, 'name' | 'group' | 'amount'>>) {
  if (!(await getHolding(id))) return null;
  const { name, group, amount } = changes;
  const identities = name !== undefined || group !== undefined ? [{ id, name, group }] : [];
  await applyPortfolioChange(
    { create: [], update: amount === undefined ? [] : [{ id, value: { amount } }], archive: [] },
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
  await assertSupportedCurrencies(plan.create);
  const rates = body.status === 'finalized' ? await ratesFor(plan.accounts.map((account) => account.currency)) : {};

  await insertHoldings(plan.create);
  const saved = await saveLedger(existing, { ...body, accounts: plan.accounts }, rates);
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

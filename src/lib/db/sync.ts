import { createHoldings, loadFinanceDoc, loadHoldingList, removeHoldings, updateHoldings } from './holdings';
import { createSnapshot, listLedgerSummaries, loadLedger, saveLedger } from './queries';
import { portfolioTotals } from '@/lib/finance';
import { planLedgerSave, planPortfolioSync } from '@/lib/portfolio-sync';
import type { MonthlyLedger, MonthlyLedgerPayload } from '@/types/ledger';

async function newestLedger() {
  return (await listLedgerSummaries())[0] ?? null;
}

// holding_id is a foreign key: create holdings before the ledger save, update/remove after.
export async function saveLedgerSynced(existing: MonthlyLedger, body: MonthlyLedgerPayload) {
  const isNewest = body.month === (await newestLedger())?.month;
  const plan = isNewest ? planLedgerSave(existing, body, await loadHoldingList()) : null;

  if (plan) await createHoldings(plan.changes.create);
  const saved = await saveLedger(existing, plan ? { ...body, accounts: plan.accounts } : body);
  if (!saved) {
    if (plan) await removeHoldings(plan.changes.create);
    return null;
  }
  if (plan) {
    await updateHoldings(plan.changes.update);
    await removeHoldings(plan.changes.remove);
  }

  if (existing.status === 'draft' && saved.status === 'finalized') {
    const portfolio = await loadFinanceDoc();
    await createSnapshot(portfolio, portfolioTotals(portfolio).grandTotal);
  }
  return saved;
}

// Read the ledger before the write: deleting a holding nulls its accounts' holding_id.
export async function withPortfolioSync<T>(write: () => Promise<T>): Promise<T> {
  const newest = await newestLedger();
  const before = await loadHoldingList();
  const ledger = newest?.status === 'draft' ? await loadLedger(newest.month) : null;
  const result = await write();
  if (!ledger) return result;

  const accounts = planPortfolioSync(ledger, before, await loadHoldingList());
  if (accounts && !(await saveLedger(ledger, { ...ledger, accounts }))) {
    throw new Error(
      `The ${ledger.month} ledger changed while syncing it with the portfolio. Save the ledger once to bring it back in step.`
    );
  }
  return result;
}

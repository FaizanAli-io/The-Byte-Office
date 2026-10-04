import { applyHoldingChanges, loadFinanceDoc, loadHoldingList } from './holdings';
import { createSnapshot, listLedgerSummaries, loadLedger, saveLedger } from './queries';
import { portfolioTotals } from '@/lib/finance';
import { planLedgerSave, planPortfolioSync } from '@/lib/portfolio-sync';
import type { MonthlyLedger, MonthlyLedgerPayload } from '@/types/ledger';

/**
 * The writes behind `portfolio-sync.ts`. Every ledger save and every portfolio
 * save goes through one of these two, which is what keeps the two in step.
 */

async function newestLedger() {
  return (await listLedgerSummaries())[0] ?? null;
}

/**
 * Saves a month; when it is the newest one, the portfolio follows it. Finalizing
 * any month also snapshots the portfolio as it now stands.
 *
 * The ledger is written first and the holdings only once that succeeds, so a
 * stale save (the `null` return) changes neither.
 */
export async function saveLedgerSynced(existing: MonthlyLedger, body: MonthlyLedgerPayload) {
  const isNewest = body.month === (await newestLedger())?.month;
  const plan = isNewest ? planLedgerSave(existing, body, await loadHoldingList()) : null;

  const saved = await saveLedger(existing, plan ? { ...body, accounts: plan.accounts } : body);
  if (!saved) return null;
  if (plan) await applyHoldingChanges(plan.changes);

  if (existing.status === 'draft' && saved.status === 'finalized') {
    const portfolio = await loadFinanceDoc();
    await createSnapshot(portfolio, portfolioTotals(portfolio).grandTotal);
  }
  return saved;
}

/**
 * Runs a portfolio write, then brings the newest month in line with what it
 * changed. A finalized month is left alone: it is read-only, and the next
 * month opens at the portfolio's figures anyway.
 */
export async function withPortfolioSync<T>(write: () => Promise<T>): Promise<T> {
  const before = await loadHoldingList();
  const result = await write();
  const newest = await newestLedger();
  if (newest?.status !== 'draft') return result;

  const after = await loadHoldingList();
  // A concurrent ledger save makes ours stale; re-planning against it once is enough.
  for (let attempt = 0; attempt < 2; attempt++) {
    const ledger = await loadLedger(newest.month);
    if (!ledger) return result;
    const accounts = planPortfolioSync(ledger, before, after);
    if (!accounts || (await saveLedger(ledger, { ...ledger, accounts }))) return result;
  }
  throw new Error(`The ${newest.month} ledger kept changing while syncing it with the portfolio`);
}

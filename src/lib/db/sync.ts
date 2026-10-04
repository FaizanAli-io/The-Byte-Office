import { createHoldings, loadFinanceDoc, loadHoldingList, removeHoldings, updateHoldings } from './holdings';
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
 * The order follows the foreign key from accounts to holdings: holdings an
 * account will point at are created before the ledger is written, and the
 * rest of the holding changes wait until it has been. A stale save (the
 * `null` return) takes its new holdings back out, so it changes nothing.
 */
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

/**
 * Runs a portfolio write, then brings the newest month in line with what it
 * changed. A finalized month is left alone: it is read-only, and the next
 * month opens at the portfolio's figures anyway.
 *
 * The month is read before the write: deleting a holding clears its accounts'
 * links in the database, and the plan needs them to know which accounts went
 * with it. Neither that nor anything else in the write touches the ledger's
 * version, so saving against the earlier read is still guarded properly.
 */
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

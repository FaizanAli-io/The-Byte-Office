import { ApiError } from '@/lib/api';
import {
  getSnapshot,
  listCategories,
  listLedgerSummaries,
  listSnapshotSummaries,
  loadHoldMovements,
  loadLedger,
} from '@/lib/db/queries';
import { loadPortfolioHoldings } from '@/lib/db/portfolio';
import { portfolioTotals, valuePkr } from '@/lib/finance';
import { categoryName, heldFunds, ledgerCategoryTotals, ledgerSummary } from '@/lib/ledger';
import { serialFor } from './action-parsing';
import { accountBalances } from './ledger-accounts';

export async function readFinanceTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'portfolio_get': {
      const [holdings, movements] = await Promise.all([loadPortfolioHoldings(), loadHoldMovements()]);
      const held = heldFunds(movements);
      const totals = portfolioTotals(holdings, held.total);
      return {
        holdings: holdings.map((holding) => ({ ...holding, valuePkr: valuePkr(holding) })),
        grandTotalPkr: totals.grandTotal,
        heldForOthersPkr: totals.held,
        netTotalPkr: totals.net,
        heldForOthers: held.byCounterparty,
      };
    }
    case 'snapshots_list':
      return listSnapshotSummaries();
    case 'snapshot_get': {
      const snapshot = await getSnapshot(args.id as string);
      if (!snapshot) throw new ApiError('Snapshot not found', 404);
      return snapshot;
    }
    case 'categories_list':
      return listCategories();
    case 'ledgers_list':
      return listLedgerSummaries();
    case 'ledger_get': {
      const [ledger, categoryList] = await Promise.all([requireLedger(args.month), listCategories()]);
      return {
        ...ledger,
        entries: ledger.entries.map((entry, index) => ({
          ...entry,
          category: categoryName(categoryList, entry.categoryId) || undefined,
          serial: serialFor(index),
        })),
      };
    }
    case 'ledger_accounts_list': {
      const ledger = await requireLedger(args.month);
      return { month: ledger.month, status: ledger.status, accounts: accountBalances(ledger) };
    }
    case 'ledger_summary': {
      const [ledger, categoryList] = await Promise.all([requireLedger(args.month), listCategories()]);
      const totals = ledgerSummary(ledger);
      const balances = accountBalances(ledger);
      return {
        month: ledger.month,
        status: ledger.status,
        entryCount: ledger.entries.length,
        totalsPkr: {
          income: totals.income,
          expenses: totals.expenses,
          netCashFlow: totals.netCashFlow,
          fundCashFlow: totals.fundFlow,
          heldFundsMovement: totals.heldMovement,
        },
        byCategoryPkr: ledgerCategoryTotals(ledger, categoryList),
        reconciliation: {
          accounts: balances.length,
          withClosingBalance: balances.filter((account) => account.difference !== undefined).length,
          balanced: balances.filter(
            (account) => account.difference !== undefined && Math.abs(account.difference) < 0.01
          ).length,
        },
      };
    }
  }
  throw new Error(`Unknown tool: ${name}`);
}

export async function requireLedger(month: unknown) {
  const ledger = await loadLedger(month as string);
  if (!ledger) throw new ApiError('Ledger not found', 404);
  return ledger;
}

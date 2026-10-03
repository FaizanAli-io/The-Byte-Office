import { pendingResult } from '@/lib/agent/action-utils';
import {
  getSnapshot,
  listCategories,
  listLedgerSummaries,
  listSnapshotSummaries,
  loadHoldings,
  loadHoldMovements,
  loadLedger,
} from '@/lib/db/queries';
import { holdingTotals } from '@/lib/finance';
import { categoryName, heldFunds } from '@/lib/ledger';
import { agentToolRegistry } from '@/lib/agent/registry';
import { proposeFinanceAction } from './actions';
import type { AgentActionType, PendingAgentAction } from '@/lib/agent/types';

export async function executeFinanceTool(
  name: string,
  args: unknown
): Promise<{ output: unknown; pendingAction?: PendingAgentAction }> {
  const input = asObject(args);

  if (name === 'portfolio_get') {
    const [portfolio, movements] = await Promise.all([loadHoldings(), loadHoldMovements()]);
    const held = heldFunds(movements);
    const totals = holdingTotals(portfolio, held.total);
    // Both totals are reported, because neither alone is the honest answer:
    // gross is what the accounts hold, net is what is actually owned.
    return {
      output: {
        ...portfolio,
        grandTotalPkr: totals.grandTotal,
        heldForOthersPkr: totals.held,
        netTotalPkr: totals.net,
        heldForOthers: held.byCounterparty,
      },
    };
  }
  if (name === 'snapshots_list') {
    return { output: await listSnapshotSummaries() };
  }
  if (name === 'snapshot_get') {
    const snapshot = await getSnapshot(requireArg(input, 'id'));
    if (!snapshot) throw new Error('Snapshot not found');
    return { output: snapshot };
  }
  if (name === 'categories_list') {
    return { output: await listCategories() };
  }
  if (name === 'ledgers_list') {
    return { output: await listLedgerSummaries() };
  }
  if (name === 'ledger_get') {
    const month = requireArg(input, 'month');
    const [ledger, categoryList] = await Promise.all([loadLedger(month), listCategories()]);
    if (!ledger) throw new Error('Ledger not found');
    // Entries carry a category id, which means nothing to a reader. The name
    // travels with it so the assistant never has to join the two lists.
    return {
      output: {
        ...ledger,
        entries: ledger.entries.map((entry, index) => ({
          ...entry,
          category: categoryName(categoryList, entry.categoryId) || undefined,
          serial: String(index + 1).padStart(4, '0'),
        })),
      },
    };
  }

  if (isWriteTool(name)) {
    return pendingResult(await proposeFinanceAction(name, input));
  }

  throw new Error(`Unknown tool: ${name}`);
}

function isWriteTool(name: string): name is AgentActionType {
  return agentToolRegistry.some((tool) => tool.name === name && tool.module === 'finance' && tool.write);
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function requireArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (typeof value !== 'string' || !value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

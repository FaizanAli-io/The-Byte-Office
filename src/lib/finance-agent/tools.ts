import { getSnapshot, listLedgerSummaries, listSnapshotSummaries, loadHoldings, loadLedger } from '@/lib/db/queries';
import { holdingTotals } from '@/lib/finance';
import { argsToMinor } from '@/lib/money';
import { agentToolRegistry, type GroqTool } from '@/lib/agent/registry';
import { proposeAgentAction } from './actions';
import type { AgentActionType, PendingAgentAction } from './types';

export type { GroqTool };

export async function executeFinanceTool(
  name: string,
  args: unknown
): Promise<{ output: unknown; pendingAction?: PendingAgentAction }> {
  const input = asObject(args);

  if (name === 'portfolio_get') {
    const portfolio = await loadHoldings();
    return { output: { ...portfolio, grandTotalPkr: holdingTotals(portfolio).grandTotal } };
  }
  if (name === 'snapshots_list') {
    return { output: await listSnapshotSummaries() };
  }
  if (name === 'snapshot_get') {
    const snapshot = await getSnapshot(requireArg(input, 'id'));
    if (!snapshot) throw new Error('Snapshot not found');
    return { output: snapshot };
  }
  if (name === 'ledgers_list') {
    return { output: await listLedgerSummaries() };
  }
  if (name === 'ledger_get') {
    const month = requireArg(input, 'month');
    const ledger = await loadLedger(month);
    if (!ledger) throw new Error('Ledger not found');
    return {
      output: {
        ...ledger,
        entries: ledger.entries.map((entry, index) => ({
          ...entry,
          serial: String(index + 1).padStart(4, '0'),
        })),
      },
    };
  }

  if (isWriteTool(name)) {
    // The model states amounts in rupees; convert before anything stores them.
    const pendingAction = await proposeAgentAction(name, argsToMinor(input));
    return {
      output: {
        status: 'pending_confirmation',
        action: pendingAction,
        instruction: 'Tell the user to review the confirmation card. Do not claim the change was applied.',
      },
      pendingAction,
    };
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

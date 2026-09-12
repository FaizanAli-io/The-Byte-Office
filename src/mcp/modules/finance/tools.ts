import type { McpServer } from '@modelcontextprotocol/server';
import { applyFinanceAction, type FinanceWriteAction } from '@/lib/finance-agent/actions';
import { executeFinanceTool } from '@/lib/finance-agent/tools';
import { runTool } from '@/mcp/result';
import {
  ledgerEntryAddSchema,
  ledgerEntryRemoveSchema,
  ledgerEntryUpdateSchema,
  ledgerGetSchema,
  portfolioItemAddSchema,
  portfolioItemRemoveSchema,
  portfolioItemUpdateSchema,
  snapshotIdSchema,
} from './schemas';

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const createWrite = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

const updateWrite = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const destructiveWrite = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export function registerFinanceTools(server: McpServer) {
  server.registerTool(
    'portfolio_get',
    {
      title: 'Get portfolio',
      description: 'Get the live portfolio, stable item IDs, balances, and PKR total.',
      annotations: readOnly,
    },
    async () => readFinance('portfolio_get')
  );

  server.registerTool(
    'snapshots_list',
    {
      title: 'List snapshots',
      description: 'List up to 50 saved portfolio snapshots, newest first.',
      annotations: readOnly,
    },
    async () => readFinance('snapshots_list')
  );

  server.registerTool(
    'snapshot_get',
    {
      title: 'Get snapshot',
      description: 'Get one saved portfolio snapshot by its stable ID.',
      inputSchema: snapshotIdSchema,
      annotations: readOnly,
    },
    async (args) => readFinance('snapshot_get', args)
  );

  server.registerTool(
    'ledgers_list',
    {
      title: 'List ledgers',
      description: 'List monthly ledgers with their status and last update time.',
      annotations: readOnly,
    },
    async () => readFinance('ledgers_list')
  );

  server.registerTool(
    'ledger_get',
    {
      title: 'Get ledger',
      description:
        'Get one monthly ledger. Each entry includes a zero-padded serial (for example, 0001) that can be used to select it for editing or removal.',
      inputSchema: ledgerGetSchema,
      annotations: readOnly,
    },
    async (args) => readFinance('ledger_get', args)
  );

  server.registerTool(
    'portfolio_item_add',
    {
      title: 'Add portfolio item',
      description: 'Add one portfolio item immediately. Use fields matching itemType.',
      inputSchema: portfolioItemAddSchema,
      annotations: createWrite,
    },
    async (args) => writeFinance('portfolio_item_add', args)
  );

  server.registerTool(
    'portfolio_item_update',
    {
      title: 'Update portfolio item',
      description: 'Update one portfolio item by stable ID. Include only changed fields.',
      inputSchema: portfolioItemUpdateSchema,
      annotations: updateWrite,
    },
    async (args) => writeFinance('portfolio_item_update', args)
  );

  server.registerTool(
    'portfolio_item_remove',
    {
      title: 'Remove portfolio item',
      description: 'Remove one portfolio item by stable ID.',
      inputSchema: portfolioItemRemoveSchema,
      annotations: destructiveWrite,
    },
    async (args) => writeFinance('portfolio_item_remove', args)
  );

  server.registerTool(
    'ledger_entry_add',
    {
      title: 'Add ledger entry',
      description:
        'Add an entry to a draft ledger immediately. Prefer accountId from ledger_get; accountName works when it matches one account. Finalized ledgers are read-only.',
      inputSchema: ledgerEntryAddSchema,
      annotations: createWrite,
    },
    async (args) => writeFinance('ledger_entry_add', args)
  );

  server.registerTool(
    'ledger_entry_update',
    {
      title: 'Update ledger entry',
      description:
        'Update a draft ledger entry by serial from ledger_get (for example, 0001). Include only changed fields.',
      inputSchema: ledgerEntryUpdateSchema,
      annotations: updateWrite,
    },
    async (args) => writeFinance('ledger_entry_update', args)
  );

  server.registerTool(
    'ledger_entry_remove',
    {
      title: 'Remove ledger entry',
      description: 'Remove a draft ledger entry by serial from ledger_get (for example, 0001).',
      inputSchema: ledgerEntryRemoveSchema,
      annotations: destructiveWrite,
    },
    async (args) => writeFinance('ledger_entry_remove', args)
  );
}

async function readFinance(name: string, args: unknown = {}) {
  return runTool(async () => {
    const { output } = await executeFinanceTool(name, args);
    return output;
  });
}

async function writeFinance(name: FinanceWriteAction, args: unknown) {
  return runTool(() => applyFinanceAction(name, args));
}

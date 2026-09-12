import { z } from 'zod/v4';
import {
  ledgerEntryAddSchema,
  ledgerEntryRemoveSchema,
  ledgerEntryUpdateSchema,
  ledgerGetSchema,
  portfolioItemAddSchema,
  portfolioItemRemoveSchema,
  portfolioItemUpdateSchema,
  snapshotIdSchema,
} from './modules/finance/schemas';

export type ToolHttpMethod = 'get' | 'post';

export type FinanceToolDefinition = {
  name: string;
  title: string;
  description: string;
  method: ToolHttpMethod;
  inputSchema?: z.ZodType;
  write: boolean;
};

const emptySchema = z.object({});

export const financeToolCatalog: FinanceToolDefinition[] = [
  {
    name: 'portfolio_get',
    title: 'Get portfolio',
    description: 'Get the live portfolio, stable item IDs, balances, and PKR total.',
    method: 'get',
    write: false,
  },
  {
    name: 'snapshots_list',
    title: 'List snapshots',
    description: 'List up to 50 saved portfolio snapshots, newest first.',
    method: 'get',
    write: false,
  },
  {
    name: 'snapshot_get',
    title: 'Get snapshot',
    description: 'Get one saved portfolio snapshot by its stable ID.',
    method: 'post',
    inputSchema: snapshotIdSchema,
    write: false,
  },
  {
    name: 'ledgers_list',
    title: 'List ledgers',
    description: 'List monthly ledgers with their status and last update time.',
    method: 'get',
    write: false,
  },
  {
    name: 'ledger_get',
    title: 'Get ledger',
    description:
      'Get one monthly ledger. Each entry includes a zero-padded serial (for example, 0001) that can be used to select it for editing or removal.',
    method: 'post',
    inputSchema: ledgerGetSchema,
    write: false,
  },
  {
    name: 'portfolio_item_add',
    title: 'Add portfolio item',
    description: 'Add one portfolio item immediately. Use fields matching itemType.',
    method: 'post',
    inputSchema: portfolioItemAddSchema,
    write: true,
  },
  {
    name: 'portfolio_item_update',
    title: 'Update portfolio item',
    description: 'Update one portfolio item by stable ID. Include only changed fields.',
    method: 'post',
    inputSchema: portfolioItemUpdateSchema,
    write: true,
  },
  {
    name: 'portfolio_item_remove',
    title: 'Remove portfolio item',
    description: 'Remove one portfolio item by stable ID.',
    method: 'post',
    inputSchema: portfolioItemRemoveSchema,
    write: true,
  },
  {
    name: 'ledger_entry_add',
    title: 'Add ledger entry',
    description:
      'Add an entry to a draft ledger immediately. Prefer accountId from ledger_get; accountName works when it matches one account. Finalized ledgers are read-only.',
    method: 'post',
    inputSchema: ledgerEntryAddSchema,
    write: true,
  },
  {
    name: 'ledger_entry_update',
    title: 'Update ledger entry',
    description:
      'Update a draft ledger entry by serial from ledger_get (for example, 0001). Include only changed fields.',
    method: 'post',
    inputSchema: ledgerEntryUpdateSchema,
    write: true,
  },
  {
    name: 'ledger_entry_remove',
    title: 'Remove ledger entry',
    description: 'Remove a draft ledger entry by serial from ledger_get (for example, 0001).',
    method: 'post',
    inputSchema: ledgerEntryRemoveSchema,
    write: true,
  },
];

export const financeToolByName = new Map(financeToolCatalog.map((tool) => [tool.name, tool]));

export function inputSchemaForTool(tool: FinanceToolDefinition) {
  return tool.inputSchema ?? emptySchema;
}

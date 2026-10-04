import { z } from 'zod/v4';
import {
  empty,
  month,
  itemType,
  categoryName,
  categoryId,
  categoryKind,
  portfolioFields,
  ledgerEntryFields,
  entryRef,
  accountFields,
  accountRef,
} from './fields';

export type AgentToolModule = 'finance' | 'personal' | 'tbo';

export type AgentToolDefinition = {
  name: string;
  title: string;
  module: AgentToolModule;
  description: string;
  chatDescription?: string;
  schema: z.ZodObject;
  write?: boolean;
  mcp?: boolean;
  destructive?: boolean;
};

export const agentToolRegistry: AgentToolDefinition[] = [
  {
    name: 'portfolio_get',
    title: 'Get portfolio',
    module: 'finance',
    description:
      'Get the live portfolio with stable item IDs and balances. Reports a gross PKR total, the amount held for other people, and the net total that is actually yours.',
    schema: empty,
    mcp: true,
  },
  {
    name: 'snapshots_list',
    title: 'List snapshots',
    module: 'finance',
    description: 'List up to 50 saved portfolio snapshots, newest first.',
    schema: empty,
    mcp: true,
  },
  {
    name: 'snapshot_get',
    title: 'Get snapshot',
    module: 'finance',
    description: 'Get one saved portfolio snapshot by its stable ID.',
    schema: z.object({ id: z.string().min(1).describe('Stable snapshot ID') }),
    mcp: true,
  },
  {
    name: 'categories_list',
    title: 'List ledger categories',
    module: 'finance',
    description:
      'List every ledger category with its id, name and whether it suits income, expense or both. Archived categories are included and marked; do not propose one for a new entry.',
    schema: empty,
    mcp: true,
  },
  {
    name: 'category_add',
    title: 'Add ledger category',
    module: 'finance',
    description: 'Create a ledger category immediately. Names are unique regardless of case.',
    chatDescription:
      'Create a confirmation proposal to add a ledger category. This never writes before user confirmation.',
    schema: z.object({ name: categoryName, kind: categoryKind.default('both') }),
    write: true,
    mcp: true,
  },
  {
    name: 'category_update',
    title: 'Update ledger category',
    module: 'finance',
    description:
      'Rename a category, change which entry types it suits, or archive and restore it. Identify it by id from categories_list. Archiving keeps it on existing entries while removing it from the picker.',
    chatDescription:
      'Create a confirmation proposal to rename, re-kind, archive or restore a ledger category, identified by id from categories_list. This never writes before confirmation.',
    schema: z.object({
      id: categoryId,
      name: z.string().min(1).optional().describe('New name'),
      kind: categoryKind.optional(),
      archived: z.boolean().optional().describe('True to archive, false to restore'),
    }),
    write: true,
    mcp: true,
  },
  {
    name: 'category_remove',
    title: 'Remove ledger category',
    module: 'finance',
    description:
      'Delete a category outright, by id from categories_list. Refused while any ledger entry still uses it — archive it instead.',
    chatDescription:
      'Create a confirmation proposal to delete a ledger category by id from categories_list. Refused while any entry still uses it.',
    schema: z.object({ id: categoryId }),
    write: true,
    destructive: true,
    mcp: true,
  },
  {
    name: 'ledgers_list',
    title: 'List ledgers',
    module: 'finance',
    description: 'List monthly ledgers with their status and last update time.',
    schema: empty,
    mcp: true,
  },
  {
    name: 'ledger_get',
    title: 'Get ledger',
    module: 'finance',
    description:
      'Get one monthly ledger. Each entry includes a zero-padded serial (for example, 0001) that can be used to select it for editing or removal.',
    schema: z.object({ month }),
    mcp: true,
  },
  {
    name: 'portfolio_item_add',
    title: 'Add portfolio item',
    module: 'finance',
    description:
      'Add one portfolio item immediately. Use fields matching itemType. The newest ledger month gains a matching account.',
    chatDescription:
      'Create a confirmation proposal to add one portfolio item. This never writes before user confirmation. Use fields matching itemType.',
    schema: z.object(portfolioFields),
    write: true,
    mcp: true,
  },
  {
    name: 'portfolio_item_update',
    title: 'Update portfolio item',
    module: 'finance',
    description:
      "Update one portfolio item by stable ID. Include only changed fields. A changed amount becomes the matching ledger account's actual closing balance in the newest month.",
    chatDescription:
      'Create a confirmation proposal to update one portfolio item by stable ID. Include only changed fields. This never writes before confirmation.',
    schema: z.object({ ...portfolioFields, id: z.string().min(1).describe('Stable portfolio item ID') }),
    write: true,
    mcp: true,
  },
  {
    name: 'portfolio_item_remove',
    title: 'Remove portfolio item',
    module: 'finance',
    description:
      'Remove one portfolio item by stable ID. Its account in the newest ledger month goes too, unless entries use it.',
    chatDescription:
      'Create a confirmation proposal to remove one portfolio item by stable ID. This never writes before confirmation.',
    schema: z.object({ itemType, id: z.string().min(1).describe('Stable portfolio item ID') }),
    write: true,
    mcp: true,
    destructive: true,
  },
  {
    name: 'ledger_entry_add',
    title: 'Add ledger entry',
    module: 'finance',
    description:
      'Add an entry to a draft ledger immediately. Prefer accountId from ledger_get; accountName works when it matches one account. Finalized ledgers are read-only.',
    chatDescription:
      'Immediately open the add-entry form for a draft ledger. Call this as soon as the user wants to add an entry. Do not ask for type, account, amount, date, or notes — the form collects them. Type defaults to expense, account to the first account, and date to today. Only month is required. The user submits the form to save; do not claim the entry was saved.',
    schema: z.object({ month, ...ledgerEntryFields }),
    write: true,
    mcp: true,
  },
  {
    name: 'ledger_entry_update',
    title: 'Update ledger entry',
    module: 'finance',
    description:
      'Update a draft ledger entry by serial from ledger_get (for example, 0001). Include only changed fields.',
    chatDescription:
      'Immediately open an edit form prefilled with an existing draft ledger entry. Use entrySerial from ledger_get (for example, 0001); entryId is only for internal compatibility. Do not ask the user to retype fields. The user submits the form to save. Do not claim the entry was updated.',
    schema: z.object({ ...entryRef, ...ledgerEntryFields }),
    write: true,
    mcp: true,
  },
  {
    name: 'ledger_entry_remove',
    title: 'Remove ledger entry',
    module: 'finance',
    description: 'Remove a draft ledger entry by serial from ledger_get (for example, 0001).',
    chatDescription:
      'Create a confirmation proposal to remove an entry from a draft ledger. Use entrySerial from ledger_get (for example, 0001); entryId is only for internal compatibility.',
    schema: z.object(entryRef),
    write: true,
    mcp: true,
    destructive: true,
  },
  {
    name: 'ledger_summary',
    title: 'Summarise ledger',
    module: 'finance',
    description:
      'Summarise one monthly ledger in PKR: income, expenses, net cash flow, fund cash flow and held-funds movement (the ledger page tiles), income and expenses by category, and how many accounts are reconciled.',
    schema: z.object({ month }),
    mcp: true,
  },
  {
    name: 'ledger_accounts_list',
    title: 'List ledger accounts and balances',
    module: 'finance',
    description:
      "List a monthly ledger's accounts with opening, expected closing and actual closing balances and the reconciliation difference; funds also report net invested and gain/loss. Balances are in each account's own currency.",
    schema: z.object({ month }),
    mcp: true,
  },
  {
    name: 'ledger_account_add',
    title: 'Add ledger account',
    module: 'finance',
    description:
      'Add an account to a draft ledger immediately. Type defaults to bank, currency to PKR and opening balance to 0. USD accounts need exchangeRate. In the newest month it also adds the matching portfolio holding.',
    chatDescription:
      'Create a confirmation proposal to add an account to a draft ledger. Type defaults to bank, currency to PKR and opening balance to 0. USD accounts need exchangeRate. Never claim it was added before confirmation.',
    schema: z.object({
      month,
      ...accountFields,
      name: z.string().min(1).describe('Account name'),
      type: z.enum(['bank', 'fund']).optional(),
      currency: z.enum(['PKR', 'USD']).optional(),
    }),
    write: true,
    mcp: true,
  },
  {
    name: 'ledger_account_update',
    title: 'Update ledger account',
    module: 'finance',
    description:
      "Update a draft ledger account's name or balances immediately, such as entering the actual closing balance from a statement. Include only changed fields.",
    chatDescription:
      "Create a confirmation proposal to update a draft ledger account's name or balances. Include only changed fields. Never claim it was saved before confirmation.",
    schema: z.object({ ...accountRef, ...accountFields }),
    write: true,
    mcp: true,
  },
  {
    name: 'ledger_account_remove',
    title: 'Remove ledger account',
    module: 'finance',
    description:
      'Remove an account from a draft ledger. Refused while any entry uses the account. In the newest month it also removes the matching portfolio holding.',
    chatDescription:
      'Create a confirmation proposal to remove an account from a draft ledger. Refused while any entry uses the account.',
    schema: z.object(accountRef),
    write: true,
    mcp: true,
    destructive: true,
  },

  {
    name: 'prayers_list',
    title: 'List prayers',
    module: 'personal',
    description:
      'List missed-prayer counts for fajr, zuhr, asar, maghreb, and isha, and when the counts were last changed.',
    schema: empty,
    mcp: true,
  },
  {
    name: 'prayer_set',
    title: 'Set missed prayers',
    module: 'personal',
    description: 'Set the missed count for one namaaz immediately.',
    chatDescription:
      'Create a confirmation proposal to set the missed count for one namaaz. Never claim the change was saved.',
    schema: z.object({
      namaaz: z.enum(['fajr', 'zuhr', 'asar', 'maghreb', 'isha']),
      missed: z.int().min(0),
    }),
    write: true,
    mcp: true,
  },
  {
    name: 'health_list',
    title: 'List health readings',
    module: 'personal',
    description: 'List health tracking entries, newest first. Optionally filter by metric name.',
    schema: z.object({ metric: z.string().min(1).optional() }),
    mcp: true,
  },
  {
    name: 'health_add',
    title: 'Add health reading',
    module: 'personal',
    description: 'Add a health metric reading immediately. createdAt is optional.',
    chatDescription: 'Create a confirmation proposal to add a health metric reading. createdAt is optional.',
    schema: z.object({ metric: z.string().min(1), value: z.number(), createdAt: z.string().optional() }),
    write: true,
    mcp: true,
  },
  {
    name: 'health_update',
    title: 'Update health reading',
    module: 'personal',
    description: 'Update one health tracking entry by id. Include only changed fields.',
    chatDescription: 'Create a confirmation proposal to update one health tracking entry by id.',
    schema: z.object({
      id: z.string().min(1),
      metric: z.string().min(1).optional(),
      value: z.number().optional(),
      createdAt: z.string().optional(),
    }),
    write: true,
    mcp: true,
  },
  {
    name: 'health_remove',
    title: 'Remove health reading',
    module: 'personal',
    description: 'Delete one health tracking entry by id.',
    chatDescription: 'Create a confirmation proposal to delete one health tracking entry by id.',
    schema: z.object({ id: z.string().min(1) }),
    write: true,
    mcp: true,
    destructive: true,
  },

  {
    name: 'tbo_info',
    title: 'Get The Byte Office information',
    module: 'tbo',
    description:
      'Get official The Byte Office information. Use this for services, work, process, FAQs, contact, or a general overview.',
    schema: z.object({
      topic: z.enum(['overview', 'services', 'projects', 'process', 'faqs', 'contact', 'all']),
    }),
    mcp: true,
  },
  {
    name: 'tbo_send_inquiry',
    title: 'Send an inquiry to The Byte Office',
    module: 'tbo',
    description:
      'Create a confirmation proposal to email The Byte Office with a visitor or user query. Never claim the email was sent until the user confirms.',
    schema: z.object({
      name: z.string().min(1),
      email: z.string().min(1),
      company: z.string().min(1).optional(),
      service: z.string().min(1).optional(),
      message: z.string().min(1),
    }),
    write: true,
  },
];

export function toolNamesForModule(module: AgentToolModule) {
  return new Set(agentToolRegistry.filter((tool) => tool.module === module).map((tool) => tool.name));
}

export const mcpToolRegistry = agentToolRegistry.filter((tool) => tool.mcp);
export const mcpToolByName = new Map(mcpToolRegistry.map((tool) => [tool.name, tool]));

export type GroqTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

// Groq rejects the `$schema` key that z.toJSONSchema adds.
function jsonSchemaFor(tool: AgentToolDefinition): Record<string, unknown> {
  const { $schema: _schema, ...parameters } = z.toJSONSchema(tool.schema) as Record<string, unknown>;
  return parameters;
}

function toGroqTool(tool: AgentToolDefinition): GroqTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.chatDescription ?? tool.description,
      parameters: jsonSchemaFor(tool),
    },
  };
}

export const groqTools: GroqTool[] = agentToolRegistry.map(toGroqTool);

export function httpMethodFor(tool: AgentToolDefinition): 'get' | 'post' {
  return Object.keys(tool.schema.shape).length === 0 ? 'get' : 'post';
}

import { z } from 'zod/v4';
import { LEDGER_ENTRY_TYPES } from '@/types/ledger';

/**
 * Every agent tool, declared once.
 *
 * Three surfaces consume this list and each used to carry its own copy of the
 * names, descriptions and schemas:
 *
 *   - the chat assistant, which needs JSON Schema for Groq's tool calling
 *   - the MCP server, which registers zod schemas and annotations
 *   - the REST wrappers under `/api/mcp/tools/{name}`, plus the OpenAPI document
 *
 * Keeping one declaration is what stops those copies drifting apart. They
 * already had: the chat catalogue promised writes were proposals while the MCP
 * catalogue described the same tool as applying immediately.
 *
 * Schemas are deliberately flat rather than discriminated unions. Tool-calling
 * models handle a flat object far better than `oneOf`, and the real per-type
 * validation happens in the action layer (`parsePortfolioItem` and friends),
 * which every surface goes through before anything is written.
 */

export type AgentToolModule = 'finance' | 'personal' | 'tbo';

export type AgentToolDefinition = {
  name: string;
  title: string;
  module: AgentToolModule;
  /** Shown to MCP clients and in the OpenAPI document. */
  description: string;
  /**
   * Shown to the chat model when it differs. Writes are proposals in chat and
   * immediate on MCP, so several tools genuinely need to say different things.
   */
  chatDescription?: string;
  schema: z.ZodObject;
  /** Mutating tools route through the action layer. */
  write?: boolean;
  /** Exposed over MCP and the REST wrappers, gated by the module's OAuth scope. */
  mcp?: boolean;
  /** Removes data, for the MCP `destructiveHint` annotation. */
  destructive?: boolean;
};

const empty = z.object({});
const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM')
  .describe('Ledger month as YYYY-MM');
const entrySerial = z
  .string()
  .regex(/^\d{4,}$/, 'Use a ledger serial such as 0001')
  .describe('Zero-padded serial from ledger_get, such as 0001');
export const itemTypeSchema = z.enum(['local_bank', 'remote_bank', 'mutual_fund']);
const itemType = itemTypeSchema;
export const entryTypeSchema = z.enum(LEDGER_ENTRY_TYPES);
const entryType = entryTypeSchema;
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('ISO date YYYY-MM-DD within the ledger month');

const portfolioFields = {
  itemType,
  name: z.string().min(1).optional().describe('Holding name'),
  amountPkr: z.number().nonnegative().optional().describe('Balance in PKR'),
  amountUsd: z.number().nonnegative().optional().describe('Balance in USD'),
  exchangeRate: z.number().positive().optional().describe('PKR per 1 USD'),
  bankName: z.string().min(1).optional(),
  fundName: z.string().min(1).optional(),
  value: z.number().nonnegative().optional().describe('Current value in PKR'),
};

const ledgerEntryFields = {
  date: isoDate.optional(),
  type: entryType.optional(),
  accountId: z.string().min(1).optional().describe('Stable account UUID when known'),
  accountName: z.string().min(1).optional().describe('Account name or shorthand, such as TBO'),
  destinationAccountId: z.string().min(1).nullable().optional(),
  amount: z.number().positive().optional(),
  destinationAmount: z.number().positive().nullable().optional(),
  exchangeRate: z.number().positive().nullable().optional(),
  category: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe('Category name from categories_list. Unknown or ambiguous names leave the entry uncategorised'),
  counterparty: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe('Whose money this is. Only for hold_received and hold_returned'),
  note: z.string().min(1).nullable().optional(),
};

const entryRef = {
  month,
  entrySerial: entrySerial.optional(),
  entryId: z.string().min(1).optional().describe('Internal entry UUID'),
};

export const agentToolRegistry: AgentToolDefinition[] = [
  // ---------------------------------------------------------------- finance
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
    description: 'Add one portfolio item immediately. Use fields matching itemType.',
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
    description: 'Update one portfolio item by stable ID. Include only changed fields.',
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
    description: 'Remove one portfolio item by stable ID.',
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

  // --------------------------------------------------------------- personal
  {
    name: 'prayers_list',
    title: 'List prayers',
    module: 'personal',
    description: 'List missed-prayer counts for fajr, zuhr, asar, maghreb, and isha.',
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
    name: 'prayer_remove',
    title: 'Remove prayer row',
    module: 'personal',
    description: 'Delete one prayer row by id.',
    chatDescription: 'Create a confirmation proposal to delete one prayer row by id.',
    schema: z.object({ id: z.string().min(1) }),
    write: true,
    mcp: true,
    destructive: true,
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

  // -------------------------------------------------------------------- tbo
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

/** Tools reachable over MCP and the REST wrappers. Each needs its module's scope. */
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

/** Groq rejects the `$schema` key that `z.toJSONSchema` adds, so drop it. */
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

/** A tool with no properties is exposed as a GET in the REST wrappers. */
export function httpMethodFor(tool: AgentToolDefinition): 'get' | 'post' {
  return Object.keys(tool.schema.shape).length === 0 ? 'get' : 'post';
}

import { ApiError } from '@/lib/api';
import { z } from 'zod/v4';
import { prayerSetSchema } from '@/lib/personal-validation';
import {
  empty,
  text,
  month,
  holdingKindSchema,
  holdingId,
  metricId,
  categoryId,
  categoryInputSchema,
  categoryChangesSchema,
  inquirySchema,
  holdingFields,
  ledgerEntryFields,
  entryFilterFields,
  entryRef,
  accountFields,
  accountRef,
  currencyCode,
} from './fields';

type AgentToolModule = 'finance' | 'personal' | 'tbo';

export type AgentToolDefinition = {
  name: string;
  title: string;
  module: AgentToolModule;
  description: string;
  chatDescription?: string;
  schema: z.ZodObject;
  write?: boolean;
  // Every tool is on MCP unless it opts out.
  mcp?: false;
  destructive?: boolean;
};

export const agentToolRegistry: AgentToolDefinition[] = [
  {
    name: 'portfolio_get',
    title: 'Get portfolio',
    module: 'finance',
    description:
      "Get the live portfolio as one list of holdings (id, kind, name, group for a fund's bank, currency, amount in that currency, the live exchangeRate in PKR per unit, valuePkr), with a gross PKR total, the amount held for other people, and the net total that is actually yours.",
    schema: empty,
  },
  {
    name: 'exchange_rates_get',
    title: 'Get exchange rates',
    module: 'finance',
    description:
      'Get the live exchange-rate table every PKR conversion uses: PKR per one unit of each supported currency, when it was last refreshed, and stale when the latest refresh failed.',
    schema: empty,
  },
  {
    name: 'exchange_rates_refresh',
    title: 'Refresh exchange rates',
    module: 'finance',
    description:
      'Fetch the latest rates from the provider now, ignoring the hourly limit, store them, and return the updated table as exchange_rates_get does. If the provider does not answer, the stored rates are left unchanged and an error is returned.',
    chatDescription:
      'Create a confirmation proposal to fetch the latest exchange rates from the provider now and store them. Never claim the rates were refreshed before confirmation.',
    schema: empty,
    write: true,
  },
  {
    name: 'snapshots_list',
    title: 'List snapshots',
    module: 'finance',
    description: 'List up to 50 saved portfolio snapshots, newest first.',
    schema: empty,
  },
  {
    name: 'snapshot_get',
    title: 'Get snapshot',
    module: 'finance',
    description: 'Get one saved portfolio snapshot by its stable ID.',
    schema: z.object({ id: text.describe('Stable snapshot ID') }),
  },
  {
    name: 'categories_list',
    title: 'List ledger categories',
    module: 'finance',
    description:
      'List every ledger category with its id, name and whether it suits income, expense or both. Archived categories are included and marked; do not propose one for a new entry.',
    schema: empty,
  },
  {
    name: 'category_add',
    title: 'Add ledger category',
    module: 'finance',
    description: 'Create a ledger category immediately. Names are unique regardless of case.',
    chatDescription:
      'Create a confirmation proposal to add a ledger category. This never writes before user confirmation.',
    schema: categoryInputSchema,
    write: true,
  },
  {
    name: 'category_update',
    title: 'Update ledger category',
    module: 'finance',
    description:
      'Rename a category, change which entry types it suits, or archive and restore it. Identify it by id from categories_list. Archiving keeps it on existing entries while removing it from the picker.',
    chatDescription:
      'Create a confirmation proposal to rename, re-kind, archive or restore a ledger category, identified by id from categories_list. This never writes before confirmation.',
    schema: categoryChangesSchema,
    write: true,
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
  },
  {
    name: 'ledgers_list',
    title: 'List ledgers',
    module: 'finance',
    description: 'List monthly ledgers with their status and last update time.',
    schema: empty,
  },
  {
    name: 'ledger_get',
    title: 'Get ledger',
    module: 'finance',
    description:
      'Get one monthly ledger. Entries can be filtered by account, type, category, text and date range, and sorted, like the ledger page; totalEntries counts them all. Each entry keeps its zero-padded serial (for example, 0001) for editing or removal.',
    schema: z.object({ month, ...entryFilterFields }),
  },
  {
    name: 'portfolio_item_add',
    title: 'Add portfolio item',
    module: 'finance',
    description:
      'Add one holding immediately: kind, name, amount, plus group for a mutual fund and currency for a remote bank. Rates are never typed: they come from the live table. The newest ledger month gains a matching account.',
    chatDescription:
      'Create a confirmation proposal to add one holding: kind, name, amount, plus group for a mutual fund and currency for a remote bank. This never writes before user confirmation.',
    schema: z.object({
      kind: holdingKindSchema,
      ...holdingFields,
      currency: currencyCode.optional().describe('Remote banks only, and required for them: ISO code such as USD'),
    }),
    write: true,
  },
  {
    name: 'portfolio_item_update',
    title: 'Update portfolio item',
    module: 'finance',
    description:
      "Update one portfolio item by stable ID. Include only changed fields; kind and currency cannot change. A changed amount becomes the matching ledger account's actual closing balance in the newest month.",
    chatDescription:
      'Create a confirmation proposal to update one portfolio item by stable ID. Include only changed fields. This never writes before confirmation.',
    schema: z.object({
      id: holdingId,
      ...z.object(holdingFields).partial().shape,
    }),
    write: true,
  },
  {
    name: 'portfolio_item_remove',
    title: 'Remove portfolio item',
    module: 'finance',
    description:
      'Remove one portfolio item by stable ID. Its account in the newest ledger month goes too, unless entries use it.',
    chatDescription:
      'Create a confirmation proposal to remove one portfolio item by stable ID. This never writes before confirmation.',
    schema: z.object({ id: holdingId }),
    write: true,
    destructive: true,
  },
  {
    name: 'ledger_entry_add',
    title: 'Add ledger entry',
    module: 'finance',
    description:
      'Add an entry to a draft ledger immediately. Prefer accountId from ledger_get; accountName works when it matches one account. For a transfer, amount is what was sent and destinationAmount what was received; any difference is added as a separate Exchange cost, Exchange gain or Transfer fees entry on the source account. Rates are stamped by the server. Finalized ledgers are read-only.',
    chatDescription:
      'Immediately open the add-entry form for a draft ledger. Call this as soon as the user wants to add an entry. Do not ask for type, account, amount, date, or notes — the form collects them. Type defaults to expense, account to the first account, and date to today. Only month is required. The user submits the form to save; do not claim the entry was saved.',
    schema: z.object({ month, ...ledgerEntryFields }),
    write: true,
  },
  {
    name: 'ledger_entry_update',
    title: 'Update ledger entry',
    module: 'finance',
    description:
      'Update a draft ledger entry by serial from ledger_get (for example, 0001). Include only changed fields. Amounts are saved as given: a transfer is not split again.',
    chatDescription:
      'Immediately open an edit form prefilled with an existing draft ledger entry. Use entrySerial from ledger_get (for example, 0001); entryId is only for internal compatibility. Do not ask the user to retype fields. The user submits the form to save. Do not claim the entry was updated.',
    schema: z.object({ ...entryRef, ...ledgerEntryFields }),
    write: true,
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
    destructive: true,
  },
  {
    name: 'ledger_summary',
    title: 'Summarise ledger',
    module: 'finance',
    description:
      'Summarise one monthly ledger in PKR: income, expenses, net cash flow, fund cash flow and held-funds movement (the ledger page tiles), income and expenses by category, and how many accounts are reconciled.',
    schema: z.object({ month }),
  },
  {
    name: 'ledger_accounts_list',
    title: 'List ledger accounts and balances',
    module: 'finance',
    description:
      "List a monthly ledger's accounts as the ledger page shows them: opening, expected closing and actual closing balances, exchange rate (live for a draft, frozen once finalized) and the reconciliation difference. Banks also report variance percent and whether they are reconciled; funds report opening cost basis, net invested and gain/loss. Balances are in each account's own currency.",
    schema: z.object({ month }),
  },
  {
    name: 'ledger_account_add',
    title: 'Add ledger account',
    module: 'finance',
    description:
      'Add an account to a draft ledger immediately. Type defaults to bank, currency to PKR and opening balance to 0; funds are always PKR. In the newest month it also adds the matching portfolio holding.',
    chatDescription:
      'Create a confirmation proposal to add an account to a draft ledger. Type defaults to bank, currency to PKR and opening balance to 0; funds are always PKR. Never claim it was added before confirmation.',
    schema: z.object({
      month,
      ...accountFields,
      name: text.describe('Account name'),
      type: z.enum(['bank', 'fund']).optional(),
      currency: currencyCode.optional(),
    }),
    write: true,
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
    destructive: true,
  },

  {
    name: 'prayers_list',
    title: 'List prayers',
    module: 'personal',
    description:
      'List missed-prayer counts for fajr, zuhr, asar, maghreb, and isha, and when the counts were last changed.',
    schema: empty,
  },
  {
    name: 'prayer_set',
    title: 'Set missed prayers',
    module: 'personal',
    description:
      'Set the missed count for one namaaz immediately. Pass test: true when testing or checking the tool, so the change is kept out of the prayer history.',
    chatDescription:
      'Create a confirmation proposal to set the missed count for one namaaz. Never claim the change was saved.',
    schema: prayerSetSchema,
    write: true,
  },
  {
    name: 'health_list',
    title: 'List health readings',
    module: 'personal',
    description:
      'List health tracking entries, newest first. Optionally filter by a metric name from health_metrics_list.',
    schema: z.object({ metric: text.optional() }),
  },
  {
    name: 'health_add',
    title: 'Add health reading',
    module: 'personal',
    description:
      'Add a health reading immediately. metric must name an existing metric from health_metrics_list; unknown names are rejected. createdAt is optional.',
    chatDescription:
      'Create a confirmation proposal to add a health reading. metric must name an existing metric from health_metrics_list. createdAt is optional.',
    schema: z.object({ metric: text, value: z.number(), createdAt: z.string().optional() }),
    write: true,
  },
  {
    name: 'health_update',
    title: 'Update health reading',
    module: 'personal',
    description:
      'Update one health tracking entry by id. Include only changed fields; a new metric must name an existing one from health_metrics_list.',
    chatDescription: 'Create a confirmation proposal to update one health tracking entry by id.',
    schema: z.object({
      id: text,
      metric: text.optional(),
      value: z.number().optional(),
      createdAt: z.string().optional(),
    }),
    write: true,
  },
  {
    name: 'health_remove',
    title: 'Remove health reading',
    module: 'personal',
    description: 'Delete one health tracking entry by id.',
    chatDescription: 'Create a confirmation proposal to delete one health tracking entry by id.',
    schema: z.object({ id: text }),
    write: true,
    destructive: true,
  },
  {
    name: 'health_metrics_list',
    title: 'List health metrics',
    module: 'personal',
    description: 'List the health metrics readings can use, with their ids and how many readings each has.',
    schema: empty,
  },
  {
    name: 'health_metric_add',
    title: 'Add health metric',
    module: 'personal',
    description: 'Create a health metric immediately. Names are unique regardless of case.',
    chatDescription: 'Create a confirmation proposal to add a health metric. Names are unique regardless of case.',
    schema: z.object({
      name: text.describe('Metric name, including its unit, such as Weight (KG)'),
    }),
    write: true,
  },
  {
    name: 'health_metric_update',
    title: 'Rename health metric',
    module: 'personal',
    description: 'Rename a health metric by id from health_metrics_list. Its readings follow.',
    chatDescription: 'Create a confirmation proposal to rename a health metric by id from health_metrics_list.',
    schema: z.object({
      id: metricId,
      name: text,
    }),
    write: true,
  },
  {
    name: 'health_metric_remove',
    title: 'Remove health metric',
    module: 'personal',
    description: 'Delete a health metric by id. Refused while any reading uses it — rename it instead.',
    chatDescription: 'Create a confirmation proposal to delete a health metric by id. Refused while readings use it.',
    schema: z.object({ id: metricId }),
    write: true,
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
  },
  {
    name: 'tbo_send_inquiry',
    title: 'Send an inquiry to The Byte Office',
    module: 'tbo',
    description:
      'Create a confirmation proposal to email The Byte Office with a visitor or user query. Never claim the email was sent until the user confirms.',
    schema: inquirySchema,
    write: true,
    mcp: false,
  },
];

export const agentToolByName = new Map(agentToolRegistry.map((tool) => [tool.name, tool]));

// The single place tool arguments are validated, for the chat assistant and MCP alike.
export function parseToolArgs(name: string, args: unknown): Record<string, unknown> {
  const tool = agentToolByName.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  const parsed = tool.schema.safeParse(args ?? {});
  if (!parsed.success) throw new ApiError(z.prettifyError(parsed.error));
  return parsed.data as Record<string, unknown>;
}

export const mcpToolRegistry = agentToolRegistry.filter((tool) => tool.mcp !== false);
export const mcpToolByName = new Map(mcpToolRegistry.map((tool) => [tool.name, tool]));

export const groqTools = agentToolRegistry.map((tool) => {
  // Groq rejects the `$schema` key that z.toJSONSchema adds.
  const { $schema: _schema, ...parameters } = z.toJSONSchema(tool.schema) as Record<string, unknown>;
  return {
    type: 'function' as const,
    function: { name: tool.name, description: tool.chatDescription ?? tool.description, parameters },
  };
});

export type GroqTool = (typeof groqTools)[number];

export const takesNoArgs = (tool: AgentToolDefinition) => Object.keys(tool.schema.shape).length === 0;

// Reads without arguments are GETs; anything that writes is a POST, even with no arguments.
export const httpMethodFor = (tool: AgentToolDefinition): 'get' | 'post' =>
  !tool.write && takesNoArgs(tool) ? 'get' : 'post';

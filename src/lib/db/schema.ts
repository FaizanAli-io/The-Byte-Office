import { sql } from 'drizzle-orm';
import { CATEGORY_KINDS, LEDGER_ENTRY_TYPES } from '@/types/ledger';
import { HOLDING_KINDS, type SnapshotHolding } from '@/types/finance';
import { NAMAAZ_VALUES, type Namaaz } from '@/types/personal';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Money is stored in major units (rupees, dollars), never paisa or cents.
const money = (name: string) => numeric(name, { precision: 18, scale: 2, mode: 'number' });
const rate = (name: string) => numeric(name, { precision: 18, scale: 6, mode: 'number' });
const utc = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => utc('created_at').notNull().defaultNow();
const updatedAt = () => utc('updated_at').notNull().defaultNow();
const sortOrder = () => integer('sort_order').notNull().default(0);

export const finance = pgSchema('finance');
export const personal = pgSchema('personal');

export const ledgerStatusEnum = finance.enum('ledger_status', ['draft', 'finalized']);
export const ledgerEntryTypeEnum = finance.enum('ledger_entry_type', LEDGER_ENTRY_TYPES);
export const categoryKindEnum = finance.enum('category_kind', CATEGORY_KINDS);
export const financeAgentActionStatusEnum = finance.enum('finance_agent_action_status', [
  'pending',
  'executing',
  'completed',
  'cancelled',
  'failed',
]);

export const holdingKindEnum = finance.enum('holding_kind', HOLDING_KINDS);

export const holdings = finance.table(
  'holdings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    kind: holdingKindEnum('kind').notNull(),
    name: text('name').notNull(),
    group: text('group_name'),
    sortOrder: sortOrder(),
    archivedAt: utc('archived_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('holdings_kind_sort_idx').on(table.kind, table.sortOrder),
    check('holdings_group_only_for_funds', sql`(${table.kind} = 'mutual_fund') = (${table.group} IS NOT NULL)`),
  ]
);

export const ledgers = finance.table(
  'ledgers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    month: text('month').notNull(),
    status: ledgerStatusEnum('status').notNull().default('draft'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    finalizedAt: utc('finalized_at'),
  },
  (table) => [
    uniqueIndex('ledgers_month_uidx').on(table.month),
    check('ledgers_month_format', sql`${table.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
  ]
);

export const ledgerAccounts = finance.table(
  'ledger_accounts',
  {
    id: uuid('id').primaryKey(),
    ledgerId: uuid('ledger_id')
      .notNull()
      .references(() => ledgers.id, { onDelete: 'cascade' }),
    holdingId: uuid('holding_id')
      .notNull()
      .references(() => holdings.id, { onDelete: 'restrict' }),
    openingBalance: money('opening_balance').notNull(),
    openingCostBasis: money('opening_cost_basis'),
    actualClosingBalance: money('actual_closing_balance'),
    exchangeRate: rate('exchange_rate').notNull().default(1),
  },
  (table) => [
    index('ledger_accounts_ledger_idx').on(table.ledgerId),
    uniqueIndex('ledger_accounts_holding_uidx').on(table.ledgerId, table.holdingId),
  ]
);

export const categories = finance.table(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    kind: categoryKindEnum('kind').notNull().default('both'),
    sortOrder: sortOrder(),
    archivedAt: utc('archived_at'),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('categories_name_uidx').on(sql`lower(${table.name})`)]
);

export const ledgerEntries = finance.table(
  'ledger_entries',
  {
    id: uuid('id').primaryKey(),
    ledgerId: uuid('ledger_id')
      .notNull()
      .references(() => ledgers.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    type: ledgerEntryTypeEnum('type').notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: 'restrict' }),
    destinationAccountId: uuid('destination_account_id').references(() => ledgerAccounts.id, { onDelete: 'restrict' }),
    amount: money('amount').notNull(),
    destinationAmount: money('destination_amount'),
    exchangeRate: rate('exchange_rate'),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'restrict' }),
    counterparty: text('counterparty'),
    note: text('note'),
    sortOrder: sortOrder(),
  },
  (table) => [
    index('ledger_entries_ledger_idx').on(table.ledgerId),
    index('ledger_entries_account_idx').on(table.accountId),
    index('ledger_entries_category_idx').on(table.categoryId),
    check('ledger_entries_amount_positive', sql`${table.amount} > 0`),
  ]
);

export type SnapshotHoldings = { holdings: SnapshotHolding[] };

export const financeSnapshots = finance.table(
  'finance_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    timestamp: utc('timestamp').notNull().defaultNow(),
    grandTotal: money('grand_total').notNull(),
    data: jsonb('data').$type<SnapshotHoldings>().notNull(),
  },
  (table) => [index('finance_snapshots_timestamp_idx').on(table.timestamp)]
);

export const financeAgentActions = finance.table(
  'finance_agent_actions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actionType: text('action_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    preview: jsonb('preview').$type<{ title: string; before?: unknown; after?: unknown }>().notNull(),
    sourceFingerprint: text('source_fingerprint'),
    status: financeAgentActionStatusEnum('status').notNull().default('pending'),
    createdAt: createdAt(),
    expiresAt: utc('expires_at').notNull(),
    executedAt: utc('executed_at'),
    error: text('error'),
  },
  (table) => [index('finance_agent_actions_status_expiry_idx').on(table.status, table.expiresAt)]
);

export const magicLinks = finance.table(
  'magic_links',
  {
    nonce: uuid('nonce').primaryKey(),
    createdAt: createdAt(),
    expiresAt: utc('expires_at').notNull(),
    consumedAt: utc('consumed_at'),
  },
  (table) => [index('magic_links_expires_idx').on(table.expiresAt)]
);

export const oauthClients = finance.table('oauth_clients', {
  clientId: uuid('client_id').defaultRandom().primaryKey(),
  clientName: text('client_name').notNull(),
  redirectUris: jsonb('redirect_uris').$type<string[]>().notNull(),
  createdAt: createdAt(),
  lastUsedAt: utc('last_used_at'),
});

export const oauthAuthorizationCodes = finance.table(
  'oauth_authorization_codes',
  {
    code: uuid('code').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
    redirectUri: text('redirect_uri').notNull(),
    codeChallenge: text('code_challenge').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
    resource: text('resource').notNull(),
    expiresAt: utc('expires_at').notNull(),
    consumedAt: utc('consumed_at'),
  },
  (table) => [index('oauth_authorization_codes_expires_idx').on(table.expiresAt)]
);

export const oauthRefreshTokens = finance.table(
  'oauth_refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tokenHash: text('token_hash').notNull().unique(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
    expiresAt: utc('expires_at').notNull(),
    revokedAt: utc('revoked_at'),
    createdAt: createdAt(),
  },
  (table) => [index('oauth_refresh_tokens_family_idx').on(table.familyId)]
);

export const agentConversations = finance.table(
  'agent_conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull().default('New chat'),
    workspace: text('workspace').notNull().default('finance'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('agent_conversations_updated_idx').on(table.updatedAt),
    index('agent_conversations_workspace_updated_idx').on(table.workspace, table.updatedAt),
    check('agent_conversations_workspace_check', sql`${table.workspace} in ('finance', 'personal')`),
  ]
);

export const financeAgentMessages = finance.table(
  'finance_agent_messages',
  {
    id: uuid('id').primaryKey(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => agentConversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    actions: jsonb('actions').$type<unknown[]>().notNull().default([]),
    isError: boolean('is_error').notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [
    index('finance_agent_messages_created_idx').on(table.createdAt),
    index('finance_agent_messages_chat_idx').on(table.chatId, table.createdAt),
  ]
);

export const toolLogTypeEnum = finance.enum('tool_log_type', ['internal', 'external']);

export const financeAgentToolLogs = finance.table(
  'finance_agent_tool_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    requestId: uuid('request_id').notNull(),
    type: toolLogTypeEnum('type').notNull().default('internal'),
    model: text('model').notNull(),
    toolCallId: text('tool_call_id').notNull(),
    toolName: text('tool_name').notNull(),
    arguments: jsonb('arguments').$type<unknown>().notNull(),
    result: jsonb('result').$type<unknown>(),
    error: text('error'),
    durationMs: integer('duration_ms'),
    createdAt: createdAt(),
  },
  (table) => [
    index('finance_agent_tool_logs_created_idx').on(table.createdAt),
    index('finance_agent_tool_logs_request_idx').on(table.requestId),
    index('finance_agent_tool_logs_tool_idx').on(table.toolName),
  ]
);

export { NAMAAZ_VALUES, type Namaaz };

export const namaazEnum = personal.enum('namaaz', NAMAAZ_VALUES);

export const prayers = personal.table(
  'prayers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    namaaz: namaazEnum('namaaz').notNull(),
    missed: integer('missed').notNull().default(0),
  },
  (table) => [
    uniqueIndex('prayers_namaaz_uidx').on(table.namaaz),
    check('prayers_missed_non_negative', sql`${table.missed} >= 0`),
  ]
);

// Append-only: never update or delete rows; the newest row is "last updated".
export const prayerHistory = personal.table('prayer_history', {
  recordedAt: utc('recorded_at').primaryKey().defaultNow(),
  counts: jsonb('counts').$type<Record<Namaaz, number>>().notNull(),
});

export const healthMetrics = personal.table(
  'health_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('health_metrics_name_uidx').on(sql`lower(${table.name})`)]
);

export const healthTracking = personal.table(
  'health_tracking',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    metricId: uuid('metric_id')
      .notNull()
      .references(() => healthMetrics.id, { onDelete: 'restrict' }),
    value: numeric('value', { precision: 10, scale: 3, mode: 'number' }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('health_tracking_created_idx').on(table.createdAt),
    index('health_tracking_metric_id_idx').on(table.metricId),
  ]
);

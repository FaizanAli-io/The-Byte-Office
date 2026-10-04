import { sql } from 'drizzle-orm';
import { CATEGORY_KINDS, LEDGER_ENTRY_TYPES } from '@/types/ledger';
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

/**
 * Money columns are `numeric(18, 2)` holding an amount in its major unit —
 * rupees for PKR, dollars for USD. That is the unit everywhere: the database,
 * the API, the MCP tools and the UI all speak the same one, so nothing ever
 * has to convert.
 *
 * Two schemas: `finance` holds the portfolio, ledgers, snapshots and the
 * assistant's conversations and pending actions; `personal` holds prayers and
 * health tracking.
 *
 * Holdings are one row per item in `holdings`, ordered by `sort_order` within
 * each kind; a mutual fund's bank is its `group_name`.
 */

/**
 * Column shapes that repeat across tables, written once.
 *
 * `money` is the major-unit amount described above; `rate` carries six
 * decimals because an exchange rate needs them and an amount does not; `utc`
 * is the only timestamp flavour this schema uses. Each is a factory rather
 * than a shared value, because a Drizzle column builder belongs to one column.
 */
const money = (name: string) => numeric(name, { precision: 18, scale: 2, mode: 'number' });
const rate = (name: string) => numeric(name, { precision: 18, scale: 6, mode: 'number' });
const utc = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => utc('created_at').notNull().defaultNow();
const updatedAt = () => utc('updated_at').notNull().defaultNow();
const sortOrder = () => integer('sort_order').notNull().default(0);

export const finance = pgSchema('finance');
export const personal = pgSchema('personal');

export const ledgerStatusEnum = finance.enum('ledger_status', ['draft', 'finalized']);
export const ledgerAccountTypeEnum = finance.enum('ledger_account_type', ['bank', 'fund']);
export const ledgerCurrencyEnum = finance.enum('ledger_currency', ['PKR', 'USD']);
export const ledgerEntryTypeEnum = finance.enum('ledger_entry_type', LEDGER_ENTRY_TYPES);
export const categoryKindEnum = finance.enum('category_kind', CATEGORY_KINDS);
export const financeAgentActionStatusEnum = finance.enum('finance_agent_action_status', [
  'pending',
  'executing',
  'completed',
  'cancelled',
  'failed',
]);

export const holdingKindEnum = finance.enum('holding_kind', ['local_bank', 'remote_bank', 'mutual_fund']);

/**
 * Every portfolio holding, one row each. `amount` is in the kind's currency —
 * PKR, except USD for a remote bank, which also carries its rate. A mutual
 * fund's `name` is the fund and `group_name` the bank it sits under; banks
 * have no group. Currency is not stored because the kind decides it.
 *
 * This replaces `local_banks`, `remote_banks` and `mutual_funds`, which stay
 * until the copy has been verified and are then dropped.
 */
export const holdings = finance.table(
  'holdings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    kind: holdingKindEnum('kind').notNull(),
    name: text('name').notNull(),
    groupName: text('group_name'),
    amount: money('amount').notNull().default(0),
    exchangeRate: rate('exchange_rate').notNull().default(1),
    sortOrder: sortOrder(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('holdings_kind_sort_idx').on(table.kind, table.sortOrder),
    check('holdings_group_only_for_funds', sql`(${table.kind} = 'mutual_fund') = (${table.groupName} IS NOT NULL)`),
    check('holdings_rate_only_for_remote', sql`${table.kind} = 'remote_bank' OR ${table.exchangeRate} = 1`),
    check('holdings_amount_non_negative', sql`${table.amount} >= 0`),
  ]
);

export const localBanks = finance.table('local_banks', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  amountPkr: money('amount_pkr').notNull().default(0),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const remoteBanks = finance.table('remote_banks', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  amountUsd: money('amount_usd').notNull().default(0),
  exchangeRate: rate('exchange_rate').notNull().default(1),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const mutualFunds = finance.table('mutual_funds', {
  id: uuid('id').defaultRandom().primaryKey(),
  bankName: text('bank_name').notNull(),
  fundName: text('fund_name').notNull(),
  value: money('value').notNull().default(0),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

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
    // The holding this account mirrors. Not a foreign key yet: holdings span
    // three tables until they are merged into one.
    holdingId: uuid('holding_id'),
    name: text('name').notNull(),
    type: ledgerAccountTypeEnum('type').notNull(),
    currency: ledgerCurrencyEnum('currency').notNull(),
    openingBalance: money('opening_balance').notNull(),
    openingCostBasis: money('opening_cost_basis'),
    actualClosingBalance: money('actual_closing_balance'),
    exchangeRate: rate('exchange_rate').notNull().default(1),
    sortOrder: sortOrder(),
  },
  (table) => [
    index('ledger_accounts_ledger_idx').on(table.ledgerId),
    // One account per holding per month.
    uniqueIndex('ledger_accounts_holding_uidx').on(table.ledgerId, table.holdingId),
  ]
);

/**
 * The canonical list of ledger categories.
 *
 * Entries reference a row rather than repeating a string, so renaming a
 * category updates every entry that used it and a typo cannot quietly invent
 * a new one. `on delete restrict` plus `archived_at` is what keeps history
 * readable: a category can leave the picker without rewriting the past.
 */
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
  // Unique on the folded name, so "Food" and "food" cannot both exist. The
  // application checks this too, for a readable message; the index is what
  // makes it true.
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
    /** Whose money a hold belongs to; null on every other entry type. */
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

export type SnapshotHoldings = {
  name: string;
  localBanks: { name: string; amountPkr: number }[];
  remoteBanks: {
    name: string;
    amountUsd: number;
    exchangeRate: number;
  }[];
  mutualFunds: Record<string, { fund: string; value: number }[]>[];
};

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

/**
 * Issued magic-link nonces, so a login link can only be redeemed once.
 * Verification claims the row with `consumed_at IS NULL`, which makes a
 * replayed link — from a forwarded email, a proxy log or browser history —
 * fail even inside its validity window.
 */
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

/**
 * OAuth 2.1 authorization server state. `/api/mcp` is a resource server and
 * these three tables are the authorization server behind it; see
 * `docs/oauth.md`.
 *
 * Clients are public — ChatGPT and Claude cannot keep a secret — so there is
 * no client secret anywhere here. PKCE is what proves a token request came
 * from whoever started the flow.
 */
export const oauthClients = finance.table('oauth_clients', {
  clientId: uuid('client_id').defaultRandom().primaryKey(),
  clientName: text('client_name').notNull(),
  // Matched exactly, never by prefix: a prefix match is an open redirect.
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

/**
 * Refresh tokens rotate: redeeming one revokes it and issues a replacement
 * carrying the same `family_id`. Presenting an already-revoked token means it
 * leaked and was replayed, so the whole family is revoked.
 *
 * `expires_at` is reset on each rotation, which makes the window measure
 * inactivity rather than time since authorization.
 */
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

export const financeAgentToolLogs = finance.table(
  'finance_agent_tool_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    requestId: uuid('request_id').notNull(),
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

export const NAMAAZ_VALUES = ['fajr', 'zuhr', 'asar', 'maghreb', 'isha'] as const;
export type Namaaz = (typeof NAMAAZ_VALUES)[number];

export const namaazEnum = personal.enum('namaaz', NAMAAZ_VALUES);

export const prayers = personal.table(
  'prayers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    namaaz: namaazEnum('namaaz').notNull(),
    missed: integer('missed').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('prayers_namaaz_uidx').on(table.namaaz),
    check('prayers_missed_non_negative', sql`${table.missed} >= 0`),
  ]
);

export const healthTracking = personal.table(
  'health_tracking',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    metric: text('metric').notNull(),
    // Readings are decimal: weight, temperature and glucose are not whole
    // numbers. Not money, so a float is fine — nothing sums these.
    value: numeric('value', { precision: 10, scale: 3, mode: 'number' }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('health_tracking_created_idx').on(table.createdAt),
    index('health_tracking_metric_idx').on(table.metric),
  ]
);

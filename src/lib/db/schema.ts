import { relations, sql } from 'drizzle-orm';
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
 * Holdings are one row per item rather than a single document, and array order
 * is kept in `sort_order`. Mutual fund rows encode their group as
 * `floor(sort_order / 1000)`.
 */

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

export const localBanks = finance.table('local_banks', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  amountPkr: numeric('amount_pkr', {
    precision: 18,
    scale: 2,
    mode: 'number',
  })
    .notNull()
    .default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const remoteBanks = finance.table('remote_banks', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  amountUsd: numeric('amount_usd', {
    precision: 18,
    scale: 2,
    mode: 'number',
  })
    .notNull()
    .default(0),
  exchangeRate: numeric('exchange_rate', {
    precision: 18,
    scale: 6,
    mode: 'number',
  })
    .notNull()
    .default(1),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const mutualFunds = finance.table('mutual_funds', {
  id: uuid('id').defaultRandom().primaryKey(),
  bankName: text('bank_name').notNull(),
  fundName: text('fund_name').notNull(),
  value: numeric('value', { precision: 18, scale: 2, mode: 'number' }).notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const ledgers = finance.table(
  'ledgers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    month: text('month').notNull(),
    status: ledgerStatusEnum('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    finalizedAt: timestamp('finalized_at', {
      withTimezone: true,
      mode: 'date',
    }),
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
    name: text('name').notNull(),
    type: ledgerAccountTypeEnum('type').notNull(),
    currency: ledgerCurrencyEnum('currency').notNull(),
    openingBalance: numeric('opening_balance', {
      precision: 18,
      scale: 2,
      mode: 'number',
    }).notNull(),
    openingCostBasis: numeric('opening_cost_basis', {
      precision: 18,
      scale: 2,
      mode: 'number',
    }),
    actualClosingBalance: numeric('actual_closing_balance', {
      precision: 18,
      scale: 2,
      mode: 'number',
    }),
    exchangeRate: numeric('exchange_rate', {
      precision: 18,
      scale: 6,
      mode: 'number',
    })
      .notNull()
      .default(1),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [index('ledger_accounts_ledger_idx').on(table.ledgerId)]
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
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('categories_name_uidx').on(table.name)]
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
    amount: numeric('amount', {
      precision: 18,
      scale: 2,
      mode: 'number',
    }).notNull(),
    destinationAmount: numeric('destination_amount', {
      precision: 18,
      scale: 2,
      mode: 'number',
    }),
    exchangeRate: numeric('exchange_rate', {
      precision: 18,
      scale: 6,
      mode: 'number',
    }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'restrict' }),
    /** Whose money a hold belongs to; null on every other entry type. */
    counterparty: text('counterparty'),
    note: text('note'),
    sortOrder: integer('sort_order').notNull().default(0),
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
    timestamp: timestamp('timestamp', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    grandTotal: numeric('grand_total', {
      precision: 18,
      scale: 2,
      mode: 'number',
    }).notNull(),
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
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    executedAt: timestamp('executed_at', {
      withTimezone: true,
      mode: 'date',
    }),
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
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true, mode: 'date' }),
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
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
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
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true, mode: 'date' }),
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
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('oauth_refresh_tokens_family_idx').on(table.familyId)]
);

export const agentConversations = finance.table(
  'agent_conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull().default('New chat'),
    workspace: text('workspace').notNull().default('finance'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
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
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
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
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
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
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
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
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('health_tracking_created_idx').on(table.createdAt),
    index('health_tracking_metric_idx').on(table.metric),
  ]
);

export const ledgersRelations = relations(ledgers, ({ many }) => ({
  accounts: many(ledgerAccounts),
  entries: many(ledgerEntries),
}));

export const ledgerAccountsRelations = relations(ledgerAccounts, ({ one, many }) => ({
  ledger: one(ledgers, {
    fields: [ledgerAccounts.ledgerId],
    references: [ledgers.id],
  }),
  entries: many(ledgerEntries, { relationName: 'entryAccount' }),
  destinationEntries: many(ledgerEntries, {
    relationName: 'entryDestination',
  }),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  ledger: one(ledgers, {
    fields: [ledgerEntries.ledgerId],
    references: [ledgers.id],
  }),
  account: one(ledgerAccounts, {
    fields: [ledgerEntries.accountId],
    references: [ledgerAccounts.id],
    relationName: 'entryAccount',
  }),
  destinationAccount: one(ledgerAccounts, {
    fields: [ledgerEntries.destinationAccountId],
    references: [ledgerAccounts.id],
    relationName: 'entryDestination',
  }),
}));

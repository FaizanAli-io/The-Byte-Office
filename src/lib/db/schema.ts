import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Maps the Mongo `finance` database to Postgres.
 *
 *   Mongo collection `data`        → local_banks, remote_banks, mutual_funds
 *   Mongo collection `ledgers`     → ledgers, ledger_accounts, ledger_entries
 *   Mongo collection `snapshots`   → finance_snapshots (JSONB copy of holdings)
 *
 * Holding tables replace the single finance document. Array order is kept in
 * `sort_order`. Ledger account/entry UUIDs from Mongo are preserved.
 */

export const ledgerStatusEnum = pgEnum("ledger_status", ["draft", "finalized"]);
export const ledgerAccountTypeEnum = pgEnum("ledger_account_type", [
  "bank",
  "fund",
]);
export const ledgerCurrencyEnum = pgEnum("ledger_currency", ["PKR", "USD"]);
export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "income",
  "expense",
  "transfer",
  "fund_contribution",
  "fund_withdrawal",
]);

export const localBanks = pgTable("local_banks", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  amountPkr: numeric("amount_pkr", {
    precision: 18,
    scale: 2,
    mode: "number",
  })
    .notNull()
    .default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const remoteBanks = pgTable("remote_banks", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  amountUsd: numeric("amount_usd", {
    precision: 18,
    scale: 2,
    mode: "number",
  })
    .notNull()
    .default(0),
  exchangeRate: numeric("exchange_rate", {
    precision: 18,
    scale: 6,
    mode: "number",
  })
    .notNull()
    .default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const mutualFunds = pgTable("mutual_funds", {
  id: uuid("id").defaultRandom().primaryKey(),
  bankName: text("bank_name").notNull(),
  fundName: text("fund_name").notNull(),
  value: numeric("value", { precision: 18, scale: 2, mode: "number" })
    .notNull()
    .default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const ledgers = pgTable(
  "ledgers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    month: text("month").notNull(),
    status: ledgerStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    finalizedAt: timestamp("finalized_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    uniqueIndex("ledgers_month_uidx").on(table.month),
    check(
      "ledgers_month_format",
      sql`${table.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`,
    ),
  ],
);

export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id: uuid("id").primaryKey(),
    ledgerId: uuid("ledger_id")
      .notNull()
      .references(() => ledgers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: ledgerAccountTypeEnum("type").notNull(),
    currency: ledgerCurrencyEnum("currency").notNull(),
    openingBalance: numeric("opening_balance", {
      precision: 18,
      scale: 2,
      mode: "number",
    }).notNull(),
    openingCostBasis: numeric("opening_cost_basis", {
      precision: 18,
      scale: 2,
      mode: "number",
    }),
    actualClosingBalance: numeric("actual_closing_balance", {
      precision: 18,
      scale: 2,
      mode: "number",
    }),
    exchangeRate: numeric("exchange_rate", {
      precision: 18,
      scale: 6,
      mode: "number",
    })
      .notNull()
      .default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("ledger_accounts_ledger_idx").on(table.ledgerId)],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey(),
    ledgerId: uuid("ledger_id")
      .notNull()
      .references(() => ledgers.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    type: ledgerEntryTypeEnum("type").notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: "restrict" }),
    destinationAccountId: uuid("destination_account_id").references(
      () => ledgerAccounts.id,
      { onDelete: "restrict" },
    ),
    amount: numeric("amount", { precision: 18, scale: 2, mode: "number" })
      .notNull(),
    destinationAmount: numeric("destination_amount", {
      precision: 18,
      scale: 2,
      mode: "number",
    }),
    exchangeRate: numeric("exchange_rate", {
      precision: 18,
      scale: 6,
      mode: "number",
    }),
    category: text("category"),
    note: text("note"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("ledger_entries_ledger_idx").on(table.ledgerId),
    index("ledger_entries_account_idx").on(table.accountId),
    check("ledger_entries_amount_positive", sql`${table.amount} > 0`),
  ],
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

export const financeSnapshots = pgTable(
  "finance_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    timestamp: timestamp("timestamp", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    grandTotal: numeric("grand_total", {
      precision: 18,
      scale: 2,
      mode: "number",
    }).notNull(),
    data: jsonb("data").$type<SnapshotHoldings>().notNull(),
  },
  (table) => [index("finance_snapshots_timestamp_idx").on(table.timestamp)],
);

export const ledgersRelations = relations(ledgers, ({ many }) => ({
  accounts: many(ledgerAccounts),
  entries: many(ledgerEntries),
}));

export const ledgerAccountsRelations = relations(
  ledgerAccounts,
  ({ one, many }) => ({
    ledger: one(ledgers, {
      fields: [ledgerAccounts.ledgerId],
      references: [ledgers.id],
    }),
    entries: many(ledgerEntries, { relationName: "entryAccount" }),
    destinationEntries: many(ledgerEntries, {
      relationName: "entryDestination",
    }),
  }),
);

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  ledger: one(ledgers, {
    fields: [ledgerEntries.ledgerId],
    references: [ledgers.id],
  }),
  account: one(ledgerAccounts, {
    fields: [ledgerEntries.accountId],
    references: [ledgerAccounts.id],
    relationName: "entryAccount",
  }),
  destinationAccount: one(ledgerAccounts, {
    fields: [ledgerEntries.destinationAccountId],
    references: [ledgerAccounts.id],
    relationName: "entryDestination",
  }),
}));

-- Schema only. Not applied to Neon yet.
-- Mongo finance.data      → local_banks, remote_banks, mutual_funds
-- Mongo finance.ledgers   → ledgers, ledger_accounts, ledger_entries
-- Mongo finance.snapshots → finance_snapshots
CREATE TYPE "public"."ledger_account_type" AS ENUM('bank', 'fund');--> statement-breakpoint
CREATE TYPE "public"."ledger_currency" AS ENUM('PKR', 'USD');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('income', 'expense', 'transfer', 'fund_contribution', 'fund_withdrawal');--> statement-breakpoint
CREATE TYPE "public"."ledger_status" AS ENUM('draft', 'finalized');--> statement-breakpoint
CREATE TABLE "finance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"grand_total" numeric(18, 2) NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ledger_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "ledger_account_type" NOT NULL,
	"currency" "ledger_currency" NOT NULL,
	"opening_balance" numeric(18, 2) NOT NULL,
	"opening_cost_basis" numeric(18, 2),
	"actual_closing_balance" numeric(18, 2),
	"exchange_rate" numeric(18, 6) DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ledger_id" uuid NOT NULL,
	"date" date NOT NULL,
	"type" "ledger_entry_type" NOT NULL,
	"account_id" uuid NOT NULL,
	"destination_account_id" uuid,
	"amount" numeric(18, 2) NOT NULL,
	"destination_amount" numeric(18, 2),
	"exchange_rate" numeric(18, 6),
	"category" text,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ledger_entries_amount_positive" CHECK ("ledger_entries"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "ledgers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" text NOT NULL,
	"status" "ledger_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finalized_at" timestamp with time zone,
	CONSTRAINT "ledgers_month_format" CHECK ("ledgers"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "local_banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"amount_pkr" numeric(18, 2) DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mutual_funds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_name" text NOT NULL,
	"fund_name" text NOT NULL,
	"value" numeric(18, 2) DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remote_banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"amount_usd" numeric(18, 2) DEFAULT 0 NOT NULL,
	"exchange_rate" numeric(18, 6) DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_ledger_id_ledgers_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."ledgers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_ledger_id_ledgers_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."ledgers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_destination_account_id_ledger_accounts_id_fk" FOREIGN KEY ("destination_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finance_snapshots_timestamp_idx" ON "finance_snapshots" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "ledger_accounts_ledger_idx" ON "ledger_accounts" USING btree ("ledger_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_ledger_idx" ON "ledger_entries" USING btree ("ledger_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_account_idx" ON "ledger_entries" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledgers_month_uidx" ON "ledgers" USING btree ("month");
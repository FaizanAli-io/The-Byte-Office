CREATE SCHEMA "finance";
--> statement-breakpoint
CREATE SCHEMA "personal";
--> statement-breakpoint
CREATE TYPE "finance"."category_kind" AS ENUM('income', 'expense', 'both');--> statement-breakpoint
CREATE TYPE "finance"."finance_agent_action_status" AS ENUM('pending', 'executing', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "finance"."holding_kind" AS ENUM('local_bank', 'remote_bank', 'mutual_fund');--> statement-breakpoint
CREATE TYPE "finance"."ledger_entry_type" AS ENUM('income', 'expense', 'transfer', 'fund_contribution', 'fund_withdrawal', 'hold_received', 'hold_returned');--> statement-breakpoint
CREATE TYPE "finance"."ledger_status" AS ENUM('draft', 'finalized');--> statement-breakpoint
CREATE TYPE "personal"."namaaz" AS ENUM('fajr', 'zuhr', 'asar', 'maghreb', 'isha');--> statement-breakpoint
CREATE TYPE "finance"."tool_log_type" AS ENUM('internal', 'external');--> statement-breakpoint
CREATE TABLE "finance"."agent_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'New chat' NOT NULL,
	"workspace" text DEFAULT 'finance' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_conversations_workspace_check" CHECK ("finance"."agent_conversations"."workspace" in ('finance', 'personal'))
);
--> statement-breakpoint
CREATE TABLE "finance"."categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "finance"."category_kind" DEFAULT 'both' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."exchange_rates" (
	"currency" text PRIMARY KEY NOT NULL,
	"value" numeric(18, 2) NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "exchange_rates_currency_code" CHECK ("finance"."exchange_rates"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "exchange_rates_value_positive" CHECK ("finance"."exchange_rates"."value" > 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."finance_agent_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"preview" jsonb NOT NULL,
	"source_fingerprint" text,
	"status" "finance"."finance_agent_action_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"executed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "finance"."finance_agent_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"chat_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_error" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."finance_agent_tool_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"type" "finance"."tool_log_type" DEFAULT 'internal' NOT NULL,
	"model" text NOT NULL,
	"tool_call_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"arguments" jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."finance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"grand_total" numeric(18, 2) NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal"."health_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal"."health_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_id" uuid NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "finance"."holding_kind" NOT NULL,
	"name" text NOT NULL,
	"group_name" text,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holdings_group_only_for_funds" CHECK (("finance"."holdings"."kind" = 'mutual_fund') = ("finance"."holdings"."group_name" IS NOT NULL)),
	CONSTRAINT "holdings_currency_code" CHECK ("finance"."holdings"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "holdings_foreign_only_remote" CHECK (("finance"."holdings"."kind" = 'remote_bank') = ("finance"."holdings"."currency" <> 'PKR'))
);
--> statement-breakpoint
CREATE TABLE "finance"."ledger_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ledger_id" uuid NOT NULL,
	"holding_id" uuid NOT NULL,
	"opening_balance" numeric(18, 2) NOT NULL,
	"opening_cost_basis" numeric(18, 2),
	"actual_closing_balance" numeric(18, 2),
	"exchange_rate" numeric(18, 2)
);
--> statement-breakpoint
CREATE TABLE "finance"."ledger_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ledger_id" uuid NOT NULL,
	"date" date NOT NULL,
	"type" "finance"."ledger_entry_type" NOT NULL,
	"account_id" uuid NOT NULL,
	"destination_account_id" uuid,
	"amount" numeric(18, 2) NOT NULL,
	"destination_amount" numeric(18, 2),
	"exchange_rate" numeric(18, 2),
	"category_id" uuid,
	"counterparty" text,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ledger_entries_amount_positive" CHECK ("finance"."ledger_entries"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."ledgers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" text NOT NULL,
	"status" "finance"."ledger_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finalized_at" timestamp with time zone,
	CONSTRAINT "ledgers_month_format" CHECK ("finance"."ledgers"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "finance"."magic_links" (
	"nonce" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "finance"."oauth_authorization_codes" (
	"code" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"resource" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "finance"."oauth_clients" (
	"client_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_name" text NOT NULL,
	"redirect_uris" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "finance"."oauth_refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"client_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"scopes" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "personal"."prayer_history" (
	"recorded_at" timestamp with time zone PRIMARY KEY DEFAULT now() NOT NULL,
	"counts" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal"."prayers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namaaz" "personal"."namaaz" NOT NULL,
	"missed" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "prayers_missed_non_negative" CHECK ("personal"."prayers"."missed" >= 0)
);
--> statement-breakpoint
ALTER TABLE "finance"."finance_agent_messages" ADD CONSTRAINT "finance_agent_messages_chat_id_agent_conversations_id_fk" FOREIGN KEY ("chat_id") REFERENCES "finance"."agent_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal"."health_tracking" ADD CONSTRAINT "health_tracking_metric_id_health_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "personal"."health_metrics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" ADD CONSTRAINT "ledger_accounts_ledger_id_ledgers_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "finance"."ledgers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" ADD CONSTRAINT "ledger_accounts_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "finance"."holdings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."ledger_entries" ADD CONSTRAINT "ledger_entries_ledger_id_ledgers_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "finance"."ledgers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "finance"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."ledger_entries" ADD CONSTRAINT "ledger_entries_destination_account_id_ledger_accounts_id_fk" FOREIGN KEY ("destination_account_id") REFERENCES "finance"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."ledger_entries" ADD CONSTRAINT "ledger_entries_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "finance"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "finance"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "finance"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_conversations_updated_idx" ON "finance"."agent_conversations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "agent_conversations_workspace_updated_idx" ON "finance"."agent_conversations" USING btree ("workspace","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_uidx" ON "finance"."categories" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "finance_agent_actions_status_expiry_idx" ON "finance"."finance_agent_actions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "finance_agent_messages_created_idx" ON "finance"."finance_agent_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "finance_agent_messages_chat_idx" ON "finance"."finance_agent_messages" USING btree ("chat_id","created_at");--> statement-breakpoint
CREATE INDEX "finance_agent_tool_logs_created_idx" ON "finance"."finance_agent_tool_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "finance_agent_tool_logs_request_idx" ON "finance"."finance_agent_tool_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "finance_agent_tool_logs_tool_idx" ON "finance"."finance_agent_tool_logs" USING btree ("tool_name");--> statement-breakpoint
CREATE INDEX "finance_snapshots_timestamp_idx" ON "finance"."finance_snapshots" USING btree ("timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "health_metrics_name_uidx" ON "personal"."health_metrics" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "health_tracking_created_idx" ON "personal"."health_tracking" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "health_tracking_metric_id_idx" ON "personal"."health_tracking" USING btree ("metric_id");--> statement-breakpoint
CREATE INDEX "holdings_kind_sort_idx" ON "finance"."holdings" USING btree ("kind","sort_order");--> statement-breakpoint
CREATE INDEX "ledger_accounts_ledger_idx" ON "finance"."ledger_accounts" USING btree ("ledger_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_holding_uidx" ON "finance"."ledger_accounts" USING btree ("ledger_id","holding_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_ledger_idx" ON "finance"."ledger_entries" USING btree ("ledger_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_account_idx" ON "finance"."ledger_entries" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_category_idx" ON "finance"."ledger_entries" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledgers_month_uidx" ON "finance"."ledgers" USING btree ("month");--> statement-breakpoint
CREATE INDEX "magic_links_expires_idx" ON "finance"."magic_links" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "oauth_authorization_codes_expires_idx" ON "finance"."oauth_authorization_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "oauth_refresh_tokens_family_idx" ON "finance"."oauth_refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prayers_namaaz_uidx" ON "personal"."prayers" USING btree ("namaaz");
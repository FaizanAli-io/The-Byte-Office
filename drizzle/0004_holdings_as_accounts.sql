CREATE TYPE "finance"."tool_log_type" AS ENUM('internal', 'external');--> statement-breakpoint
ALTER TABLE "finance"."finance_agent_tool_logs" ADD COLUMN "type" "finance"."tool_log_type" DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."holdings" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "finance"."holdings" DROP CONSTRAINT "holdings_rate_only_for_remote";--> statement-breakpoint
ALTER TABLE "finance"."holdings" DROP CONSTRAINT "holdings_amount_non_negative";--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" DROP CONSTRAINT "ledger_accounts_holding_id_holdings_id_fk";
--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" ALTER COLUMN "holding_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" ADD CONSTRAINT "ledger_accounts_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "finance"."holdings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."holdings" DROP COLUMN "amount";--> statement-breakpoint
ALTER TABLE "finance"."holdings" DROP COLUMN "exchange_rate";--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" DROP COLUMN "sort_order";--> statement-breakpoint
DROP TYPE "finance"."ledger_account_type";--> statement-breakpoint
DROP TYPE "finance"."ledger_currency";

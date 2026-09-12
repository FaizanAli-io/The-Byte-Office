CREATE SCHEMA "finance";--> statement-breakpoint
CREATE SCHEMA "personal";--> statement-breakpoint
ALTER TYPE "public"."ledger_account_type" SET SCHEMA "finance";--> statement-breakpoint
ALTER TYPE "public"."ledger_currency" SET SCHEMA "finance";--> statement-breakpoint
ALTER TYPE "public"."ledger_entry_type" SET SCHEMA "finance";--> statement-breakpoint
ALTER TYPE "public"."ledger_status" SET SCHEMA "finance";--> statement-breakpoint
ALTER TYPE "public"."finance_agent_action_status" SET SCHEMA "finance";--> statement-breakpoint
ALTER TABLE "public"."finance_snapshots" SET SCHEMA "finance";--> statement-breakpoint
ALTER TABLE "public"."ledger_accounts" SET SCHEMA "finance";--> statement-breakpoint
ALTER TABLE "public"."ledger_entries" SET SCHEMA "finance";--> statement-breakpoint
ALTER TABLE "public"."ledgers" SET SCHEMA "finance";--> statement-breakpoint
ALTER TABLE "public"."local_banks" SET SCHEMA "finance";--> statement-breakpoint
ALTER TABLE "public"."mutual_funds" SET SCHEMA "finance";--> statement-breakpoint
ALTER TABLE "public"."remote_banks" SET SCHEMA "finance";--> statement-breakpoint
ALTER TABLE "public"."finance_agent_actions" SET SCHEMA "finance";--> statement-breakpoint
ALTER TABLE "public"."finance_agent_messages" SET SCHEMA "finance";--> statement-breakpoint
ALTER TABLE "public"."finance_agent_tool_logs" SET SCHEMA "finance";

ALTER TYPE "finance"."ledger_entry_type" ADD VALUE 'hold_received';--> statement-breakpoint
ALTER TYPE "finance"."ledger_entry_type" ADD VALUE 'hold_returned';--> statement-breakpoint
ALTER TABLE "finance"."ledger_entries" ADD COLUMN "counterparty" text;
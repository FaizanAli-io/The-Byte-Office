ALTER TABLE "finance"."ledger_entries" DROP CONSTRAINT "ledger_entries_amount_positive";--> statement-breakpoint
ALTER TABLE "finance"."ledgers" DROP CONSTRAINT "ledgers_month_format";--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" DROP CONSTRAINT "ledger_accounts_ledger_id_ledgers_id_fk";
--> statement-breakpoint
ALTER TABLE "finance"."ledger_entries" DROP CONSTRAINT "ledger_entries_ledger_id_ledgers_id_fk";
--> statement-breakpoint
ALTER TABLE "finance"."ledger_entries" DROP CONSTRAINT "ledger_entries_account_id_ledger_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "finance"."ledger_entries" DROP CONSTRAINT "ledger_entries_destination_account_id_ledger_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" ADD CONSTRAINT "ledger_accounts_ledger_id_ledgers_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "finance"."ledgers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."ledger_entries" ADD CONSTRAINT "ledger_entries_ledger_id_ledgers_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "finance"."ledgers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "finance"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."ledger_entries" ADD CONSTRAINT "ledger_entries_destination_account_id_ledger_accounts_id_fk" FOREIGN KEY ("destination_account_id") REFERENCES "finance"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."ledger_entries" ADD CONSTRAINT "ledger_entries_amount_positive" CHECK ("finance"."ledger_entries"."amount" > 0);--> statement-breakpoint
ALTER TABLE "finance"."ledgers" ADD CONSTRAINT "ledgers_month_format" CHECK ("finance"."ledgers"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
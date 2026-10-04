-- Holdings have lived in "finance"."holdings" since 0002, the copy was verified
-- against these tables, and nothing reads or writes them any more. Plain DROP
-- rather than CASCADE: if anything unexpected still depended on them, this
-- fails and changes nothing instead of taking the dependant with it.
DROP TABLE "finance"."local_banks";--> statement-breakpoint
DROP TABLE "finance"."remote_banks";--> statement-breakpoint
DROP TABLE "finance"."mutual_funds";--> statement-breakpoint
-- Ledger accounts now point at a real holding. Deleting a holding clears the
-- link rather than being refused, so past months keep their accounts.
ALTER TABLE "finance"."ledger_accounts" ADD CONSTRAINT "ledger_accounts_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "finance"."holdings"("id") ON DELETE set null ON UPDATE no action;

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
--> statement-breakpoint
-- Prayer history: every change to the counts as a snapshot of all five, with
-- the newest row being "last updated". It replaces the per-row updated_at,
-- which any write could overwrite.
CREATE TABLE "personal"."prayer_history" (
	"recorded_at" timestamp with time zone PRIMARY KEY DEFAULT now() NOT NULL,
	"counts" jsonb NOT NULL
);
--> statement-breakpoint
-- Seed it with the counts as they stand, at the time they were last changed,
-- before that timestamp is dropped. Missing namaaz count as zero.
INSERT INTO "personal"."prayer_history" ("recorded_at", "counts")
SELECT coalesce(max("updated_at"), now()), jsonb_build_object(
  'fajr', coalesce(max("missed") FILTER (WHERE "namaaz" = 'fajr'), 0),
  'zuhr', coalesce(max("missed") FILTER (WHERE "namaaz" = 'zuhr'), 0),
  'asar', coalesce(max("missed") FILTER (WHERE "namaaz" = 'asar'), 0),
  'maghreb', coalesce(max("missed") FILTER (WHERE "namaaz" = 'maghreb'), 0),
  'isha', coalesce(max("missed") FILTER (WHERE "namaaz" = 'isha'), 0)
)
FROM "personal"."prayers";
--> statement-breakpoint
ALTER TABLE "personal"."prayers" DROP COLUMN "updated_at";

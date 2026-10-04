DROP TABLE "finance"."local_banks";--> statement-breakpoint
DROP TABLE "finance"."remote_banks";--> statement-breakpoint
DROP TABLE "finance"."mutual_funds";--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" ADD CONSTRAINT "ledger_accounts_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "finance"."holdings"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "personal"."prayer_history" (
	"recorded_at" timestamp with time zone PRIMARY KEY DEFAULT now() NOT NULL,
	"counts" jsonb NOT NULL
);
--> statement-breakpoint
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

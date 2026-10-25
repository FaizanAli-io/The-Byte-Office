CREATE TABLE "finance"."exchange_rates" (
	"currency" text PRIMARY KEY NOT NULL,
	"value" numeric(18, 2) NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "exchange_rates_currency_code" CHECK ("finance"."exchange_rates"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "exchange_rates_value_positive" CHECK ("finance"."exchange_rates"."value" > 0)
);
--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" ALTER COLUMN "exchange_rate" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "finance"."ledger_accounts" ALTER COLUMN "exchange_rate" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."holdings" ADD COLUMN "currency" text DEFAULT 'PKR' NOT NULL;--> statement-breakpoint
UPDATE "finance"."holdings" SET "currency" = 'USD' WHERE "kind" = 'remote_bank';--> statement-breakpoint
UPDATE "finance"."ledger_accounts" AS a SET "exchange_rate" = NULL
  FROM "finance"."ledgers" AS l WHERE l."id" = a."ledger_id" AND l."status" = 'draft';--> statement-breakpoint
ALTER TABLE "finance"."holdings" ADD CONSTRAINT "holdings_currency_code" CHECK ("finance"."holdings"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "finance"."holdings" ADD CONSTRAINT "holdings_foreign_only_remote" CHECK (("finance"."holdings"."kind" = 'remote_bank') = ("finance"."holdings"."currency" <> 'PKR'));
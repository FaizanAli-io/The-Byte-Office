CREATE TYPE "finance"."holding_kind" AS ENUM('local_bank', 'remote_bank', 'mutual_fund');--> statement-breakpoint
CREATE TABLE "finance"."holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "finance"."holding_kind" NOT NULL,
	"name" text NOT NULL,
	"group_name" text,
	"amount" numeric(18, 2) DEFAULT 0 NOT NULL,
	"exchange_rate" numeric(18, 6) DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holdings_group_only_for_funds" CHECK (("finance"."holdings"."kind" = 'mutual_fund') = ("finance"."holdings"."group_name" IS NOT NULL)),
	CONSTRAINT "holdings_rate_only_for_remote" CHECK ("finance"."holdings"."kind" = 'remote_bank' OR "finance"."holdings"."exchange_rate" = 1),
	CONSTRAINT "holdings_amount_non_negative" CHECK ("finance"."holdings"."amount" >= 0)
);
--> statement-breakpoint
CREATE INDEX "holdings_kind_sort_idx" ON "finance"."holdings" USING btree ("kind","sort_order");--> statement-breakpoint
-- Copy every holding across with its id, order and timestamps unchanged, so
-- ledger links, assistant proposals and the editor all keep pointing at the
-- same rows. The old tables are not touched; they stay until the copy is
-- verified and a later migration drops them. The kinds are cast explicitly:
-- inside a UNION a bare literal is text, which an enum column will not take.
INSERT INTO "finance"."holdings" ("id", "kind", "name", "group_name", "amount", "exchange_rate", "sort_order", "created_at", "updated_at")
SELECT "id", 'local_bank'::"finance"."holding_kind", "name", NULL, "amount_pkr", 1, "sort_order", "created_at", "updated_at" FROM "finance"."local_banks"
UNION ALL
SELECT "id", 'remote_bank'::"finance"."holding_kind", "name", NULL, "amount_usd", "exchange_rate", "sort_order", "created_at", "updated_at" FROM "finance"."remote_banks"
UNION ALL
SELECT "id", 'mutual_fund'::"finance"."holding_kind", "fund_name", "bank_name", "value", 1, "sort_order", "created_at", "updated_at" FROM "finance"."mutual_funds";

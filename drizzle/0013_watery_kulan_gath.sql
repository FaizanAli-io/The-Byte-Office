CREATE TYPE "finance"."category_kind" AS ENUM('income', 'expense', 'both');--> statement-breakpoint
CREATE TABLE "finance"."categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "finance"."category_kind" DEFAULT 'both' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance"."ledger_entries" ADD COLUMN "category_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_uidx" ON "finance"."categories" USING btree ("name");--> statement-breakpoint
ALTER TABLE "finance"."ledger_entries" ADD CONSTRAINT "ledger_entries_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "finance"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_entries_category_idx" ON "finance"."ledger_entries" USING btree ("category_id");--> statement-breakpoint
-- Back-fill: one category per distinct name already in use. The kind is
-- inferred from how the name has actually been used, so a category seen only
-- on expenses starts as an expense rather than as the permissive default.
INSERT INTO "finance"."categories" ("name", "kind", "sort_order")
SELECT
	trim("category") AS name,
	(CASE
		WHEN bool_and("type" = 'income') THEN 'income'
		WHEN bool_and("type" = 'expense') THEN 'expense'
		ELSE 'both'
	END)::"finance"."category_kind",
	(row_number() OVER (ORDER BY trim("category")) - 1)::integer
FROM "finance"."ledger_entries"
WHERE "category" IS NOT NULL AND trim("category") <> ''
GROUP BY trim("category");
--> statement-breakpoint
-- Point every entry at its category. Matching on the same trim() that created
-- the rows means each non-blank category is guaranteed to find exactly one.
UPDATE "finance"."ledger_entries" AS e
SET "category_id" = c."id"
FROM "finance"."categories" AS c
WHERE c."name" = trim(e."category") AND e."category" IS NOT NULL AND trim(e."category") <> '';
--> statement-breakpoint
-- "Reconciliation" is the one category the application writes by itself, from
-- the force-reconcile button, so it has to exist rather than being typed.
INSERT INTO "finance"."categories" ("name", "kind", "sort_order")
SELECT 'Reconciliation', 'both', coalesce(max("sort_order"), -1) + 1 FROM "finance"."categories"
ON CONFLICT ("name") DO NOTHING;

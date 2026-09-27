-- Categories that differ only by case are merged before the index starts
-- refusing them. Migration 0013 back-filled one row per distinct spelling, so
-- "Food" and "food" both exist wherever both were typed.
--
-- The spelling the most entries already use wins; everything back-filled in
-- one statement shares a created_at, so that count is the only meaningful
-- tie-break. The two subqueries below are textually identical on purpose —
-- they must pick the same winner.
--
-- Entries pointing at a loser are re-pointed first, because the foreign key
-- is `on delete restrict` and would otherwise refuse the cleanup.
UPDATE "finance"."ledger_entries" AS e
SET "category_id" = w."id"
FROM "finance"."categories" AS c
JOIN (
	SELECT DISTINCT ON (lower("name")) "id", lower("name") AS folded
	FROM "finance"."categories"
	ORDER BY
		lower("name"),
		(SELECT count(*) FROM "finance"."ledger_entries" x WHERE x."category_id" = "categories"."id") DESC,
		"created_at",
		"id"
) AS w ON w.folded = lower(c."name")
WHERE e."category_id" = c."id" AND c."id" <> w."id";
--> statement-breakpoint
DELETE FROM "finance"."categories" AS c
USING (
	SELECT DISTINCT ON (lower("name")) "id", lower("name") AS folded
	FROM "finance"."categories"
	ORDER BY
		lower("name"),
		(SELECT count(*) FROM "finance"."ledger_entries" x WHERE x."category_id" = "categories"."id") DESC,
		"created_at",
		"id"
) AS w
WHERE lower(c."name") = w.folded AND c."id" <> w."id";
--> statement-breakpoint
DROP INDEX "finance"."categories_name_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_uidx" ON "finance"."categories" USING btree (lower("name"));

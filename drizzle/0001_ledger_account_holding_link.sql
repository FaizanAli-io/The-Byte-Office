ALTER TABLE "finance"."ledger_accounts" ADD COLUMN "holding_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_holding_uidx" ON "finance"."ledger_accounts" USING btree ("ledger_id","holding_id");--> statement-breakpoint
-- Link existing accounts to the holding each was copied from. Ledger accounts
-- were created by copying the portfolio, so names match exactly; a fund's
-- account is named "Bank · Fund".
UPDATE "finance"."ledger_accounts" AS la SET "holding_id" = h."id"
FROM "finance"."local_banks" AS h
WHERE la."holding_id" IS NULL AND la."type" = 'bank' AND la."currency" = 'PKR' AND la."name" = h."name";--> statement-breakpoint
UPDATE "finance"."ledger_accounts" AS la SET "holding_id" = h."id"
FROM "finance"."remote_banks" AS h
WHERE la."holding_id" IS NULL AND la."type" = 'bank' AND la."currency" = 'USD' AND la."name" = h."name";--> statement-breakpoint
UPDATE "finance"."ledger_accounts" AS la SET "holding_id" = h."id"
FROM "finance"."mutual_funds" AS h
WHERE la."holding_id" IS NULL AND la."type" = 'fund' AND la."name" = h."bank_name" || ' · ' || h."fund_name";--> statement-breakpoint
-- Give every holding an account in the newest month, if it is still a draft.
-- From here on the app keeps the two in step.
INSERT INTO "finance"."ledger_accounts"
  ("id", "ledger_id", "holding_id", "name", "type", "currency", "opening_balance", "opening_cost_basis", "exchange_rate", "sort_order")
SELECT gen_random_uuid(), l."id", h."id", h."name", h."type"::"finance"."ledger_account_type", h."currency"::"finance"."ledger_currency",
  h."amount", h."cost_basis", h."rate",
  (SELECT coalesce(max("sort_order"), -1) FROM "finance"."ledger_accounts" WHERE "ledger_id" = l."id") + row_number() OVER (ORDER BY h."kind", h."sort_order")
FROM (
  SELECT "id" FROM "finance"."ledgers"
  WHERE "status" = 'draft' AND "month" = (SELECT max("month") FROM "finance"."ledgers")
) AS l
CROSS JOIN (
  SELECT 1 AS "kind", "id", "name", 'bank' AS "type", 'PKR' AS "currency", "amount_pkr" AS "amount", NULL::numeric AS "cost_basis", 1::numeric AS "rate", "sort_order" FROM "finance"."local_banks"
  UNION ALL
  SELECT 2, "id", "name", 'bank', 'USD', "amount_usd", NULL, "exchange_rate", "sort_order" FROM "finance"."remote_banks"
  UNION ALL
  SELECT 3, "id", "bank_name" || ' · ' || "fund_name", 'fund', 'PKR', "value", "value", 1, "sort_order" FROM "finance"."mutual_funds"
) AS h
WHERE NOT EXISTS (
  SELECT 1 FROM "finance"."ledger_accounts" AS la WHERE la."ledger_id" = l."id" AND la."holding_id" = h."id"
);

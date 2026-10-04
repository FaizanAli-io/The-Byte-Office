CREATE TABLE "personal"."health_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "personal"."health_tracking" ADD COLUMN "metric_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "health_metrics_name_uidx" ON "personal"."health_metrics" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "personal"."health_tracking" ADD CONSTRAINT "health_tracking_metric_id_health_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "personal"."health_metrics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "health_tracking_metric_id_idx" ON "personal"."health_tracking" USING btree ("metric_id");
--> statement-breakpoint
INSERT INTO "personal"."health_metrics" ("name")
SELECT DISTINCT ON (lower(trim("metric"))) trim("metric") FROM "personal"."health_tracking" ORDER BY lower(trim("metric")), "metric";--> statement-breakpoint
UPDATE "personal"."health_tracking" AS t SET "metric_id" = m."id"
FROM "personal"."health_metrics" AS m WHERE lower(m."name") = lower(trim(t."metric"));--> statement-breakpoint
DROP INDEX "personal"."health_tracking_metric_idx";--> statement-breakpoint
ALTER TABLE "personal"."health_tracking" ALTER COLUMN "metric_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "personal"."health_tracking" DROP COLUMN "metric";

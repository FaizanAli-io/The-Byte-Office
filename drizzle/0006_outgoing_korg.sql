CREATE TYPE "personal"."namaaz" AS ENUM('fajr', 'zuhr', 'asar', 'maghreb', 'isha');--> statement-breakpoint
CREATE TABLE "personal"."health_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric" text NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal"."prayers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namaaz" "personal"."namaaz" NOT NULL,
	"missed" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prayers_missed_non_negative" CHECK ("personal"."prayers"."missed" >= 0)
);
--> statement-breakpoint
CREATE INDEX "health_tracking_created_idx" ON "personal"."health_tracking" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "health_tracking_metric_idx" ON "personal"."health_tracking" USING btree ("metric");--> statement-breakpoint
CREATE UNIQUE INDEX "prayers_namaaz_uidx" ON "personal"."prayers" USING btree ("namaaz");
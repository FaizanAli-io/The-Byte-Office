CREATE TYPE "public"."finance_agent_action_status" AS ENUM('pending', 'executing', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TABLE "finance_agent_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"preview" jsonb NOT NULL,
	"source_fingerprint" text,
	"status" "finance_agent_action_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"executed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE INDEX "finance_agent_actions_status_expiry_idx" ON "finance_agent_actions" USING btree ("status","expires_at");
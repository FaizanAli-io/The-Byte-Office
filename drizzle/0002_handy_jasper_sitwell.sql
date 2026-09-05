CREATE TABLE "finance_agent_tool_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"model" text NOT NULL,
	"tool_call_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"arguments" jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "finance_agent_tool_logs_created_idx" ON "finance_agent_tool_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "finance_agent_tool_logs_request_idx" ON "finance_agent_tool_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "finance_agent_tool_logs_tool_idx" ON "finance_agent_tool_logs" USING btree ("tool_name");
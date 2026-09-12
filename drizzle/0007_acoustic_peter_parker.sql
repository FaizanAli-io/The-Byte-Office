CREATE TABLE "finance"."agent_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'New chat' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agent_conversations_updated_idx" ON "finance"."agent_conversations" USING btree ("updated_at");--> statement-breakpoint
INSERT INTO "finance"."agent_conversations" ("title") VALUES ('Finance');--> statement-breakpoint
ALTER TABLE "finance"."finance_agent_messages" ADD COLUMN "chat_id" uuid;--> statement-breakpoint
UPDATE "finance"."finance_agent_messages" SET "chat_id" = (SELECT "id" FROM "finance"."agent_conversations" ORDER BY "created_at" LIMIT 1);--> statement-breakpoint
ALTER TABLE "finance"."finance_agent_messages" ALTER COLUMN "chat_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."finance_agent_messages" ADD CONSTRAINT "finance_agent_messages_chat_id_agent_conversations_id_fk" FOREIGN KEY ("chat_id") REFERENCES "finance"."agent_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finance_agent_messages_chat_idx" ON "finance"."finance_agent_messages" USING btree ("chat_id","created_at");

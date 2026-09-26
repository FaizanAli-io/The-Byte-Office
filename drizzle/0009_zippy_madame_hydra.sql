CREATE TABLE "finance"."magic_links" (
	"nonce" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "magic_links_expires_idx" ON "finance"."magic_links" USING btree ("expires_at");
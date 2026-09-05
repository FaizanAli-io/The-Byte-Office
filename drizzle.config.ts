import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

function migrationUrl() {
  if (process.env.DATABASE_URL_UNPOOLED) {
    return process.env.DATABASE_URL_UNPOOLED;
  }

  const pooled = process.env.DATABASE_URL;
  if (!pooled) {
    throw new Error("DATABASE_URL is not set");
  }

  // Drizzle Kit needs a direct connection. Strip Neon's pooler hostname if needed.
  return pooled.replace("-pooler.", ".");
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl(),
  },
});

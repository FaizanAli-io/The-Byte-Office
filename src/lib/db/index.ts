import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Please add DATABASE_URL to .env");
  }
  return url;
}

export function getSql() {
  return neon(databaseUrl());
}

export function getDb() {
  return drizzle(getSql(), { schema });
}

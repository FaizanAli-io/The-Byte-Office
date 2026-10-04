import { eq, sql, type Column } from 'drizzle-orm';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID.test(value);
}

/**
 * `eq` on a uuid column where a malformed id matches nothing. Plain `eq` hands
 * it to Postgres, which raises 22P02 — a 500 on REST, and the raw query text
 * echoed back to an MCP client.
 */
export function idEq(column: Column, id: string) {
  return isUuid(id) ? eq(column, id) : sql`false`;
}

import { eq, sql, type Column } from 'drizzle-orm';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID.test(value);
}

// A malformed id matches nothing instead of raising 22P02 (which leaked SQL over MCP).
export function idEq(column: Column, id: string) {
  return isUuid(id) ? eq(column, id) : sql`false`;
}

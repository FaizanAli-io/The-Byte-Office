import nextEnv from '@next/env';
import { fileURLToPath } from 'node:url';

nextEnv.loadEnvConfig(fileURLToPath(new URL('..', import.meta.url)));

/**
 * The schemas this application owns. `drizzle` holds the migration
 * bookkeeping, and a restore that left it behind would put the database and
 * the migration history out of step — so it travels with the data.
 */
export const SCHEMAS = ['finance', 'personal', 'drizzle'];

/**
 * Connection details for the Postgres command line tools.
 *
 * The password goes through the environment rather than the argument list,
 * because anything in argv is readable by every process on the machine.
 * Neon's pooler endpoint cannot serve `pg_dump`, so the direct host is used —
 * the same rule `drizzle.config.ts` applies for migrations.
 */
export function connection() {
  const direct = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL?.replace('-pooler.', '.');
  if (!direct) {
    console.error('DATABASE_URL is not set. Add it to .env.local before backing up or restoring.');
    process.exit(1);
  }

  const url = new URL(direct);
  return {
    label: `${url.pathname.slice(1)} on ${url.hostname}`,
    args: [
      '-h',
      url.hostname,
      '-p',
      url.port || '5432',
      '-U',
      decodeURIComponent(url.username),
      '-d',
      url.pathname.slice(1),
    ],
    env: {
      ...process.env,
      PGPASSWORD: decodeURIComponent(url.password),
      PGSSLMODE: url.searchParams.get('sslmode') ?? 'require',
    },
  };
}

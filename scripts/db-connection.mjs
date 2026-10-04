import nextEnv from '@next/env';
import { fileURLToPath } from 'node:url';

nextEnv.loadEnvConfig(fileURLToPath(new URL('..', import.meta.url)));

export const SCHEMAS = ['finance', 'personal', 'drizzle'];

// The password goes through env, not argv, which other processes can read.
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

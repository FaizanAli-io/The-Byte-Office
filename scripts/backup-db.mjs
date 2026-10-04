import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { connection, SCHEMAS } from './db-connection.mjs';

const { args, env, label } = connection();

mkdirSync('backups', { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const file = `backups/${stamp}.sql`;

console.log(`Dumping ${SCHEMAS.join(', ')} from ${label}…`);

const result = spawnSync(
  'pg_dump',
  [...args, ...SCHEMAS.flatMap((schema) => ['--schema', schema]), '--no-owner', '--no-privileges', '--file', file],
  { env, stdio: 'inherit' }
);

if (result.error?.code === 'ENOENT') {
  console.error('\npg_dump is not on your PATH. On macOS: brew install libpq && brew link --force libpq');
  process.exit(1);
}
if (result.status !== 0) {
  console.error('\npg_dump failed. Nothing was written.');
  process.exit(result.status ?? 1);
}

const { size } = statSync(file);
console.log(`\nWrote ${file} (${(size / 1024).toFixed(0)} KB)`);
console.log(`Restore it with: npm run db:restore -- ${file}`);

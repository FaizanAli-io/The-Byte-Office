/**
 * Replaces the application's schemas with the contents of a backup.
 *
 *   npm run db:restore                     # the newest file in ./backups
 *   npm run db:restore -- backups/x.sql    # a specific one
 *   npm run db:restore -- --yes            # skip the prompt
 *
 * This is destructive: the schemas are dropped and rebuilt, so anything
 * written since the backup is gone. It runs as one transaction with
 * ON_ERROR_STOP, so a failure part way through rolls back and leaves the
 * database exactly as it was rather than half restored.
 */
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { connection, SCHEMAS } from './db-connection.mjs';

const argv = process.argv.slice(2);
const skipPrompt = argv.includes('--yes');
const requested = argv.find((arg) => !arg.startsWith('--'));
const file = requested ?? newestBackup();

if (!file) {
  console.error('No backups found. Run `npm run db:backup` first, or pass a file path.');
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`No such file: ${file}`);
  process.exit(1);
}

const { args, env, label } = connection();
const { size, mtime } = statSync(file);

console.log(`Restore   ${file}`);
console.log(`Taken     ${mtime.toLocaleString()} (${(size / 1024).toFixed(0)} KB)`);
console.log(`Into      ${label}`);
console.log(`\nThis DROPS ${SCHEMAS.join(', ')} and rebuilds them. Anything written since the backup is lost.`);

if (!skipPrompt) {
  if (!process.stdin.isTTY) {
    console.error('\nRefusing to restore without a confirmation. Re-run with --yes if you mean it.');
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('\nType the database name to confirm: ');
  rl.close();
  if (answer.trim() !== label.split(' on ')[0]) {
    console.error('Did not match. Nothing was changed.');
    process.exit(1);
  }
}

// One psql invocation so the drop and the reload share a transaction: -c and
// -f run in the order given, and --single-transaction wraps the lot.
const result = spawnSync(
  'psql',
  [
    ...args,
    '--single-transaction',
    '--set',
    'ON_ERROR_STOP=1',
    '--quiet',
    '--command',
    `DROP SCHEMA IF EXISTS ${SCHEMAS.map((schema) => `"${schema}"`).join(', ')} CASCADE`,
    '--file',
    file,
  ],
  { env, stdio: 'inherit' }
);

if (result.error?.code === 'ENOENT') {
  console.error('\npsql is not on your PATH. On macOS: brew install libpq && brew link --force libpq');
  process.exit(1);
}
if (result.status !== 0) {
  console.error('\nRestore failed and was rolled back. The database is unchanged.');
  process.exit(result.status ?? 1);
}

console.log('\nRestored. Run `npx drizzle-kit check` to confirm the migration state agrees.');

function newestBackup() {
  if (!existsSync('backups')) return undefined;
  const files = readdirSync('backups')
    .filter((name) => name.endsWith('.sql'))
    .sort();
  return files.length ? `backups/${files[files.length - 1]}` : undefined;
}

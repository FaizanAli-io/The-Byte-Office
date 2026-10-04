/**
 * Checks that `finance.holdings` holds exactly what the three old tables hold.
 *
 *   npm run db:verify-holdings
 *
 * Read-only: every query runs inside a READ ONLY transaction, so this cannot
 * change anything. Before migration 0002 has run it checks the migration's
 * own copy query instead (a dry run); afterwards it checks the real table.
 * Exits non-zero on any difference — the app must not switch over until this
 * passes.
 */
import nextEnv from '@next/env';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

nextEnv.loadEnvConfig(fileURLToPath(new URL('..', import.meta.url)));
const sql = neon(process.env.DATABASE_URL);

const COPY = `
  SELECT id, 'local_bank' AS kind, name, NULL AS group_name, amount_pkr AS amount, 1::numeric AS exchange_rate, sort_order, created_at, updated_at FROM finance.local_banks
  UNION ALL SELECT id, 'remote_bank', name, NULL, amount_usd, exchange_rate, sort_order, created_at, updated_at FROM finance.remote_banks
  UNION ALL SELECT id, 'mutual_fund', fund_name, bank_name, value, 1, sort_order, created_at, updated_at FROM finance.mutual_funds`;

const [[{ exists }]] = await sql.transaction([sql`SELECT to_regclass('finance.holdings') IS NOT NULL AS exists`], {
  readOnly: true,
});
const source = exists
  ? 'SELECT id, kind::text, name, group_name, amount, exchange_rate, sort_order, created_at, updated_at FROM finance.holdings'
  : COPY;

const [legacy, copied, [{ ro }]] = await sql.transaction(
  [
    sql.query(`${COPY} ORDER BY id`),
    sql.query(`${source} ORDER BY id`),
    sql`SELECT current_setting('transaction_read_only') AS ro`,
  ],
  { readOnly: true }
);
if (ro !== 'on') throw new Error('Refusing to continue outside a read-only transaction');

console.log(
  exists
    ? 'Checking finance.holdings against the old tables.'
    : 'Dry run: finance.holdings does not exist yet, checking the copy query.'
);

const problems = [];
const byId = new Map(copied.map((row) => [row.id, row]));
const NUMERIC = new Set(['amount', 'exchange_rate', 'sort_order']);
const FIELDS = ['kind', 'name', 'group_name', 'amount', 'exchange_rate', 'sort_order', 'created_at', 'updated_at'];
for (const row of legacy) {
  const twin = byId.get(row.id);
  if (!twin) {
    problems.push(`missing: ${row.kind} ${row.name} (${row.id})`);
    continue;
  }
  for (const field of FIELDS) {
    // Numerics compare as numbers: the old tables have no rate column for most kinds, so `1` meets `1.000000`.
    const same = NUMERIC.has(field)
      ? Number(row[field]) === Number(twin[field])
      : String(row[field]) === String(twin[field]);
    if (!same) problems.push(`${row.id} ${field}: ${row[field]} → ${twin[field]}`);
  }
  byId.delete(row.id);
}
for (const extra of byId.values()) problems.push(`extra row in holdings: ${extra.kind} ${extra.name} (${extra.id})`);

// The grand total, computed from each side.
const total = (rows) =>
  rows.reduce((sum, row) => sum + Number(row.amount) * (row.kind === 'remote_bank' ? Number(row.exchange_rate) : 1), 0);
const [before, after] = [total(legacy), total(copied)];
if (Math.abs(before - after) >= 0.005) problems.push(`grand total: ${before} → ${after}`);

// The editor's document, grouped the old way (sort-order stride) and the new way (bank name).
const funds = (rows) => rows.filter((row) => row.kind === 'mutual_fund').sort((a, b) => a.sort_order - b.sort_order);
const oldGroups = new Map();
for (const row of funds(legacy)) {
  const key = Math.floor(row.sort_order / 1000);
  oldGroups.set(key, [...(oldGroups.get(key) ?? [row.group_name]), `${row.name}=${row.amount}`]);
}
const newGroups = new Map();
for (const row of funds(copied))
  newGroups.set(row.group_name, [...(newGroups.get(row.group_name) ?? [row.group_name]), `${row.name}=${row.amount}`]);
const asText = (groups) => JSON.stringify([...groups.values()]);
if (asText(oldGroups) !== asText(newGroups))
  problems.push(`fund grouping: ${asText(oldGroups)} → ${asText(newGroups)}`);

const counts = (rows) =>
  Object.fromEntries(
    ['local_bank', 'remote_bank', 'mutual_fund'].map((kind) => [kind, rows.filter((row) => row.kind === kind).length])
  );
console.table({ 'old tables': { ...counts(legacy), total: before }, holdings: { ...counts(copied), total: after } });

if (problems.length) {
  console.error(`\n${problems.length} difference(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nAll ${legacy.length} holdings match: every field, the grand total and the fund grouping.`);

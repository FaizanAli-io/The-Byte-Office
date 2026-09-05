import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { MongoClient } from "mongodb";
import { randomUUID } from "crypto";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const MUTUAL_FUND_GROUP_STRIDE = 1000;

function flattenMutualFunds(groups = []) {
  return groups.flatMap((group, groupIndex) => {
    const bankName = Object.keys(group)[0] ?? "";
    return (group[bankName] ?? []).map((fund, fundIndex) => ({
      bankName,
      fundName: fund.fund,
      value: fund.value,
      sortOrder: groupIndex * MUTUAL_FUND_GROUP_STRIDE + fundIndex,
    }));
  });
}

function toIso(value) {
  return new Date(value).toISOString();
}

const mongoUri = process.env.MONGODB_URI;
const databaseUrl = process.env.DATABASE_URL;
if (!mongoUri || !databaseUrl) {
  throw new Error("MONGODB_URI and DATABASE_URL must be set");
}

const sql = neon(databaseUrl);
const mongo = new MongoClient(mongoUri);

await mongo.connect();
const financeDb = mongo.db("finance");

const [existing] = await sql`
  SELECT
    (SELECT count(*)::int FROM local_banks) AS local_banks,
    (SELECT count(*)::int FROM remote_banks) AS remote_banks,
    (SELECT count(*)::int FROM mutual_funds) AS mutual_funds,
    (SELECT count(*)::int FROM ledgers) AS ledgers,
    (SELECT count(*)::int FROM finance_snapshots) AS finance_snapshots
`;

const alreadyCopied =
  existing.local_banks +
    existing.remote_banks +
    existing.mutual_funds +
    existing.ledgers +
    existing.finance_snapshots >
  0;

if (alreadyCopied) {
  console.log("Postgres already has finance rows; skipping import.");
  console.log(existing);
  await mongo.close();
  process.exit(0);
}

const financeDoc = await financeDb.collection("data").findOne({ name: "finance" });
const ledgerDocs = await financeDb.collection("ledgers").find({}).toArray();
const snapshotDocs = await financeDb.collection("snapshots").find({}).toArray();

console.log(
  `mongo: finance=${financeDoc ? 1 : 0} ledgers=${ledgerDocs.length} snapshots=${snapshotDocs.length}`,
);

if (financeDoc) {
  const statements = [
    sql`DELETE FROM local_banks`,
    sql`DELETE FROM remote_banks`,
    sql`DELETE FROM mutual_funds`,
  ];
  (financeDoc.localBanks ?? []).forEach((bank, index) => {
    statements.push(
      sql`INSERT INTO local_banks (name, amount_pkr, sort_order) VALUES (${bank.name}, ${bank.amountPkr}, ${index})`,
    );
  });
  (financeDoc.remoteBanks ?? []).forEach((bank, index) => {
    statements.push(
      sql`INSERT INTO remote_banks (name, amount_usd, exchange_rate, sort_order) VALUES (${bank.name}, ${bank.amountUsd}, ${bank.exchangeRate}, ${index})`,
    );
  });
  flattenMutualFunds(financeDoc.mutualFunds).forEach((fund) => {
    statements.push(
      sql`INSERT INTO mutual_funds (bank_name, fund_name, value, sort_order) VALUES (${fund.bankName}, ${fund.fundName}, ${fund.value}, ${fund.sortOrder})`,
    );
  });
  await sql.transaction(statements);
}

for (const ledger of ledgerDocs) {
  const id = randomUUID();
  const createdAt = toIso(ledger.createdAt);
  const updatedAt = toIso(ledger.updatedAt);
  const finalizedAt = ledger.finalizedAt ? toIso(ledger.finalizedAt) : null;
  const statements = [
    sql`INSERT INTO ledgers (id, month, status, created_at, updated_at, finalized_at) VALUES (${id}, ${ledger.month}, ${ledger.status}, ${createdAt}, ${updatedAt}, ${finalizedAt})`,
  ];
  (ledger.accounts ?? []).forEach((account, index) => {
    statements.push(
      sql`INSERT INTO ledger_accounts (id, ledger_id, name, type, currency, opening_balance, opening_cost_basis, actual_closing_balance, exchange_rate, sort_order) VALUES (${account.id}, ${id}, ${account.name}, ${account.type}, ${account.currency}, ${account.openingBalance}, ${account.openingCostBasis ?? null}, ${account.actualClosingBalance ?? null}, ${account.exchangeRate}, ${index})`,
    );
  });
  (ledger.entries ?? []).forEach((entry, index) => {
    statements.push(
      sql`INSERT INTO ledger_entries (id, ledger_id, date, type, account_id, destination_account_id, amount, destination_amount, exchange_rate, category, note, sort_order) VALUES (${entry.id}, ${id}, ${entry.date}, ${entry.type}, ${entry.accountId}, ${entry.destinationAccountId ?? null}, ${entry.amount}, ${entry.destinationAmount ?? null}, ${entry.exchangeRate ?? null}, ${entry.category ?? null}, ${entry.note ?? null}, ${index})`,
    );
  });
  await sql.transaction(statements);
}

for (const snapshot of snapshotDocs) {
  const timestamp = toIso(snapshot.timestamp);
  const data = {
    name: snapshot.data?.name ?? "finance",
    localBanks: snapshot.data?.localBanks ?? [],
    remoteBanks: snapshot.data?.remoteBanks ?? [],
    mutualFunds: snapshot.data?.mutualFunds ?? [],
  };
  await sql`INSERT INTO finance_snapshots (timestamp, grand_total, data) VALUES (${timestamp}, ${snapshot.grandTotal}, ${JSON.stringify(data)})`;
}

const [copied] = await sql`
  SELECT
    (SELECT count(*)::int FROM local_banks) AS local_banks,
    (SELECT count(*)::int FROM remote_banks) AS remote_banks,
    (SELECT count(*)::int FROM mutual_funds) AS mutual_funds,
    (SELECT count(*)::int FROM ledgers) AS ledgers,
    (SELECT count(*)::int FROM ledger_accounts) AS ledger_accounts,
    (SELECT count(*)::int FROM ledger_entries) AS ledger_entries,
    (SELECT count(*)::int FROM finance_snapshots) AS finance_snapshots
`;

console.log("postgres:", copied);
await mongo.close();

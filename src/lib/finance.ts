import type { FinanceDoc, FinanceFund } from '@/types/finance';

/**
 * Totals are computed over flat holding rows, which both callers can produce:
 * the editor and snapshots hold a grouped `FinanceDoc`, while the assistant's
 * `portfolio_get` serves the rows straight from `loadHoldings`. Previously each
 * had its own copy of the arithmetic.
 */
export type HoldingRows = {
  localBanks: { amountPkr: number }[];
  remoteBanks: { amountUsd: number; exchangeRate: number }[];
  mutualFunds: { value: number }[];
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/**
 * Every total is in PKR; remote banks are converted at their own rate.
 *
 * `grandTotal` is gross: what the accounts actually hold, which is the number
 * reconciliation has to agree with. `net` subtracts money being held for
 * someone else, which is the number that is actually yours. `held` comes from
 * the ledger's hold entries and is passed in, so this stays a pure function
 * over holdings.
 */
export function holdingTotals(rows: HoldingRows, held = 0) {
  const local = sum(rows.localBanks.map((bank) => bank.amountPkr));
  const remote = sum(rows.remoteBanks.map((bank) => bank.amountUsd * bank.exchangeRate));
  const mutual = sum(rows.mutualFunds.map((fund) => fund.value));
  const grandTotal = local + remote + mutual;
  return { local, remote, mutual, grandTotal, held, net: grandTotal - held };
}

/** `mutualFunds` is an array of single-key `{ [bank]: funds }` objects. */
function fundGroups(data: Pick<FinanceDoc, 'mutualFunds'>): { bank: string; funds: FinanceFund[] }[] {
  return data.mutualFunds.map((group) => {
    const bank = Object.keys(group)[0];
    return { bank, funds: group[bank] ?? [] };
  });
}

export function portfolioTotals(data: Pick<FinanceDoc, 'localBanks' | 'remoteBanks' | 'mutualFunds'>, held = 0) {
  return holdingTotals({ ...data, mutualFunds: fundGroups(data).flatMap((group) => group.funds) }, held);
}

export function portfolioAllocations(data: Pick<FinanceDoc, 'localBanks' | 'remoteBanks' | 'mutualFunds'>) {
  const totals = portfolioTotals(data);
  return [
    { name: 'Local banks', value: totals.local },
    { name: 'Remote banks', value: totals.remote },
    { name: 'Mutual funds', value: totals.mutual },
  ];
}

export function bankFundAllocations(data: Pick<FinanceDoc, 'mutualFunds'>) {
  return fundGroups(data).map(({ bank, funds }) => ({
    name: bank,
    value: sum(funds.map((fund) => fund.value)),
  }));
}

export function individualFundAllocations(data: Pick<FinanceDoc, 'mutualFunds'>) {
  return fundGroups(data).flatMap(({ bank, funds }) =>
    funds.map((fund) => ({ name: `${bank}: ${fund.fund}`, value: fund.value }))
  );
}

type SnapshotData = Pick<FinanceDoc, 'localBanks' | 'remoteBanks' | 'mutualFunds'>;

/** PKR values keyed by kind and name; a repeated name adds up rather than overwriting. */
function keyedValues() {
  const values = new Map<string, { kind: string; name: string; value: number }>();
  const add = (kind: string, name: string, value: number) => {
    const key = `${kind}\u0000${name}`;
    values.set(key, { kind, name, value: (values.get(key)?.value ?? 0) + value });
  };
  return { values, add };
}

/** Every holding as one PKR value. */
function snapshotLines(data: SnapshotData) {
  const { values, add } = keyedValues();
  data.localBanks.forEach((bank) => add('Local bank', bank.name, bank.amountPkr));
  data.remoteBanks.forEach((bank) => add('Remote bank', bank.name, bank.amountUsd * bank.exchangeRate));
  individualFundAllocations(data).forEach((fund) => add('Mutual fund', fund.name, fund.value));
  return values;
}

/**
 * Everything worth graphing in one snapshot, at every grain: the total, each
 * class, each bank account, each fund institution and each fund. `kind` is the
 * group a picker shows it under.
 */
export function snapshotSeries(data: SnapshotData) {
  const { values, add } = keyedValues();
  const totals = portfolioTotals(data);
  add('Totals', 'Total', totals.grandTotal);
  portfolioAllocations(data).forEach((row) => add('Totals', row.name, row.value));
  snapshotLines(data).forEach((line) =>
    add(line.kind === 'Mutual fund' ? 'Funds' : 'Bank accounts', line.name, line.value)
  );
  bankFundAllocations(data).forEach((row) => add('Fund institutions', row.name, row.value));
  return values;
}

const change = (before: number | null, after: number | null) => ({
  before,
  after,
  delta: (after ?? 0) - (before ?? 0),
});

/**
 * What moved between two snapshots, in PKR. Snapshots store no row ids, so
 * holdings match by name: a rename reads as one removed line and one added
 * (`before` or `after` is `null`). Unchanged lines are left out.
 */
export function snapshotDiff(older: SnapshotData, newer: SnapshotData) {
  const [a, b] = [portfolioTotals(older), portfolioTotals(newer)];
  const classes = (
    [
      ['Local banks', 'local'],
      ['Remote banks', 'remote'],
      ['Mutual funds', 'mutual'],
      ['Total', 'grandTotal'],
    ] as const
  ).map(([name, key]) => ({ name, ...change(a[key], b[key]) }));

  const [before, after] = [snapshotLines(older), snapshotLines(newer)];
  const lines = [...new Set([...before.keys(), ...after.keys()])]
    .map((key) => {
      const line = (after.get(key) ?? before.get(key))!;
      return {
        kind: line.kind,
        name: line.name,
        ...change(before.get(key)?.value ?? null, after.get(key)?.value ?? null),
      };
    })
    .filter((line) => line.delta !== 0 || line.before === null || line.after === null)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

  return { classes, lines };
}

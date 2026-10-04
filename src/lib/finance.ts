import type { FinanceDoc, FinanceFund } from '@/types/finance';

export type HoldingRows = {
  localBanks: { amountPkr: number }[];
  remoteBanks: { amountUsd: number; exchangeRate: number }[];
  mutualFunds: { value: number }[];
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export function holdingTotals(rows: HoldingRows, held = 0) {
  const local = sum(rows.localBanks.map((bank) => bank.amountPkr));
  const remote = sum(rows.remoteBanks.map((bank) => bank.amountUsd * bank.exchangeRate));
  const mutual = sum(rows.mutualFunds.map((fund) => fund.value));
  const grandTotal = local + remote + mutual;
  return { local, remote, mutual, grandTotal, held, net: grandTotal - held };
}

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

function keyedValues() {
  const values = new Map<string, { kind: string; name: string; value: number }>();
  const add = (kind: string, name: string, value: number) => {
    const key = `${kind}\u0000${name}`;
    values.set(key, { kind, name, value: (values.get(key)?.value ?? 0) + value });
  };
  return { values, add };
}

function snapshotLines(data: SnapshotData) {
  const { values, add } = keyedValues();
  data.localBanks.forEach((bank) => add('Local bank', bank.name, bank.amountPkr));
  data.remoteBanks.forEach((bank) => add('Remote bank', bank.name, bank.amountUsd * bank.exchangeRate));
  individualFundAllocations(data).forEach((fund) => add('Mutual fund', fund.name, fund.value));
  return values;
}

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

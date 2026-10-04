import type { HoldingKind, SnapshotHolding } from '@/types/finance';

type Valued = Pick<SnapshotHolding, 'kind' | 'name' | 'group' | 'amount' | 'exchangeRate'>;

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export const valuePkr = (holding: Pick<Valued, 'kind' | 'amount' | 'exchangeRate'>) =>
  holding.kind === 'remote_bank' ? holding.amount * holding.exchangeRate : holding.amount;

const totalOf = (holdings: Valued[], kind: HoldingKind) =>
  sum(holdings.filter((holding) => holding.kind === kind).map(valuePkr));

export function portfolioTotals(holdings: Valued[], held = 0) {
  const local = totalOf(holdings, 'local_bank');
  const remote = totalOf(holdings, 'remote_bank');
  const mutual = totalOf(holdings, 'mutual_fund');
  const grandTotal = local + remote + mutual;
  return { local, remote, mutual, grandTotal, held, net: grandTotal - held };
}

export function portfolioAllocations(holdings: Valued[]) {
  const totals = portfolioTotals(holdings);
  return [
    { name: 'Local banks', value: totals.local },
    { name: 'Remote banks', value: totals.remote },
    { name: 'Mutual funds', value: totals.mutual },
  ];
}

export function fundGroups<T extends Valued>(holdings: T[]) {
  const groups = new Map<string, T[]>();
  for (const fund of holdings.filter((holding) => holding.kind === 'mutual_fund')) {
    groups.set(fund.group ?? '', [...(groups.get(fund.group ?? '') ?? []), fund]);
  }
  return [...groups].map(([bank, funds]) => ({ bank, funds }));
}

export function bankFundAllocations(holdings: Valued[]) {
  return fundGroups(holdings).map(({ bank, funds }) => ({ name: bank, value: sum(funds.map(valuePkr)) }));
}

export function individualFundAllocations(holdings: Valued[]) {
  return fundGroups(holdings).flatMap(({ bank, funds }) =>
    funds.map((fund) => ({ name: `${bank}: ${fund.name}`, value: fund.amount }))
  );
}

const KIND_LABELS: Record<HoldingKind, string> = {
  local_bank: 'Local bank',
  remote_bank: 'Remote bank',
  mutual_fund: 'Mutual fund',
};

function keyedValues() {
  const values = new Map<string, { kind: string; name: string; value: number }>();
  const add = (kind: string, name: string, value: number) => {
    const key = `${kind}\u0000${name}`;
    values.set(key, { kind, name, value: (values.get(key)?.value ?? 0) + value });
  };
  return { values, add };
}

function snapshotLines(holdings: Valued[]) {
  const { values, add } = keyedValues();
  for (const holding of holdings) {
    const name = holding.kind === 'mutual_fund' ? `${holding.group ?? ''}: ${holding.name}` : holding.name;
    add(KIND_LABELS[holding.kind], name, valuePkr(holding));
  }
  return values;
}

export function snapshotSeries(holdings: Valued[]) {
  const { values, add } = keyedValues();
  add('Totals', 'Total', portfolioTotals(holdings).grandTotal);
  portfolioAllocations(holdings).forEach((row) => add('Totals', row.name, row.value));
  snapshotLines(holdings).forEach((line) =>
    add(line.kind === 'Mutual fund' ? 'Funds' : 'Bank accounts', line.name, line.value)
  );
  bankFundAllocations(holdings).forEach((row) => add('Fund institutions', row.name, row.value));
  return values;
}

const change = (before: number | null, after: number | null) => ({
  before,
  after,
  delta: (after ?? 0) - (before ?? 0),
});

export function snapshotDiff(older: Valued[], newer: Valued[]) {
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

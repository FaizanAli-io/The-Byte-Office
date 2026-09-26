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

/** Every total is in PKR; remote banks are converted at their own rate. */
export function holdingTotals(rows: HoldingRows) {
  const local = sum(rows.localBanks.map((bank) => bank.amountPkr));
  const remote = sum(rows.remoteBanks.map((bank) => bank.amountUsd * bank.exchangeRate));
  const mutual = sum(rows.mutualFunds.map((fund) => fund.value));
  return { local, remote, mutual, grandTotal: local + remote + mutual };
}

/** `mutualFunds` is an array of single-key `{ [bank]: funds }` objects. */
export function fundGroups(data: Pick<FinanceDoc, 'mutualFunds'>): { bank: string; funds: FinanceFund[] }[] {
  return data.mutualFunds.map((group) => {
    const bank = Object.keys(group)[0];
    return { bank, funds: group[bank] ?? [] };
  });
}

export function portfolioTotals(data: Pick<FinanceDoc, 'localBanks' | 'remoteBanks' | 'mutualFunds'>) {
  return holdingTotals({ ...data, mutualFunds: fundGroups(data).flatMap((group) => group.funds) });
}

export function portfolioAllocations(data: FinanceDoc) {
  const totals = portfolioTotals(data);
  return [
    { name: 'Local banks', value: totals.local },
    { name: 'Remote banks', value: totals.remote },
    { name: 'Mutual funds', value: totals.mutual },
  ];
}

export function bankFundAllocations(data: FinanceDoc) {
  return fundGroups(data).map(({ bank, funds }) => ({
    name: bank,
    value: sum(funds.map((fund) => fund.value)),
  }));
}

export function individualFundAllocations(data: FinanceDoc) {
  return fundGroups(data).flatMap(({ bank, funds }) =>
    funds.map((fund) => ({ name: `${bank}: ${fund.fund}`, value: fund.value }))
  );
}

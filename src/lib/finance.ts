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

export function holdingTotals(rows: HoldingRows) {
  const local = rows.localBanks.reduce((sum, bank) => sum + bank.amountPkr, 0);
  const remote = rows.remoteBanks.reduce((sum, bank) => sum + bank.amountUsd * bank.exchangeRate, 0);
  const mutual = rows.mutualFunds.reduce((sum, fund) => sum + fund.value, 0);
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
    value: funds.reduce((sum, fund) => sum + fund.value, 0),
  }));
}

export function individualFundAllocations(data: FinanceDoc) {
  return fundGroups(data).flatMap(({ bank, funds }) =>
    funds.map((fund) => ({ name: `${bank}: ${fund.fund}`, value: fund.value }))
  );
}

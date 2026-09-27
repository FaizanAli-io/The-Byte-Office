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

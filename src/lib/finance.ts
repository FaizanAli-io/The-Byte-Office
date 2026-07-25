import type { FinanceDoc } from "@/types/finance";

export function portfolioTotals(
  data: Pick<FinanceDoc, "localBanks" | "remoteBanks" | "mutualFunds">,
) {
  const local = data.localBanks.reduce((sum, bank) => sum + bank.amountPkr, 0);
  const remote = data.remoteBanks.reduce(
    (sum, bank) => sum + bank.amountUsd * bank.exchangeRate,
    0,
  );
  const mutual = data.mutualFunds.reduce((total, group) => {
    const bank = Object.keys(group)[0];
    return (
      total + (group[bank] ?? []).reduce((sum, fund) => sum + fund.value, 0)
    );
  }, 0);
  return { local, remote, mutual, grandTotal: local + remote + mutual };
}

export function portfolioAllocations(data: FinanceDoc) {
  const totals = portfolioTotals(data);
  return [
    { name: "Local banks", value: totals.local },
    { name: "Remote banks", value: totals.remote },
    { name: "Mutual funds", value: totals.mutual },
  ];
}

export function bankFundAllocations(data: FinanceDoc) {
  return data.mutualFunds.map((group) => {
    const bank = Object.keys(group)[0];
    return {
      name: bank,
      value: (group[bank] ?? []).reduce((sum, fund) => sum + fund.value, 0),
    };
  });
}

export function individualFundAllocations(data: FinanceDoc) {
  return data.mutualFunds.flatMap((group) => {
    const bank = Object.keys(group)[0];
    return (group[bank] ?? []).map((fund) => ({
      name: `${bank}: ${fund.fund}`,
      value: fund.value,
    }));
  });
}

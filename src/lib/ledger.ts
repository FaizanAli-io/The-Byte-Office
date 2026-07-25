import type { LedgerAccount, LedgerEntry, MonthlyLedger } from "@/types/ledger";

export const ENTRY_LABELS: Record<LedgerEntry["type"], string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
  fund_contribution: "Fund contribution",
  fund_withdrawal: "Fund withdrawal",
};

export function isMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    min: `${month}-01`,
    max: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "PKR" ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function accountMovement(accountId: string, entry: LedgerEntry) {
  if (entry.type === "transfer") {
    if (entry.accountId === accountId) return -entry.amount;
    if (entry.destinationAccountId === accountId) {
      return entry.destinationAmount ?? entry.amount;
    }
    return 0;
  }

  if (entry.accountId !== accountId) return 0;
  if (entry.type === "income" || entry.type === "fund_contribution") {
    return entry.amount;
  }
  return -entry.amount;
}

export function expectedBalance(
  account: LedgerAccount,
  entries: LedgerEntry[],
) {
  return entries.reduce(
    (balance, entry) => balance + accountMovement(account.id, entry),
    account.openingBalance,
  );
}

export function accountStats(account: LedgerAccount, entries: LedgerEntry[]) {
  const expected = expectedBalance(account, entries);
  const actual = account.actualClosingBalance;
  const netInvested =
    (account.openingCostBasis ?? account.openingBalance) +
    entries.reduce((total, entry) => {
      if (entry.accountId === account.id) {
        if (entry.type === "fund_contribution") return total + entry.amount;
        if (entry.type === "fund_withdrawal") return total - entry.amount;
      }
      if (
        entry.destinationAccountId === account.id &&
        entry.type === "transfer" &&
        account.type === "fund"
      ) {
        return total + (entry.destinationAmount ?? entry.amount);
      }
      if (
        entry.accountId === account.id &&
        entry.type === "transfer" &&
        account.type === "fund"
      ) {
        return total - entry.amount;
      }
      return total;
    }, 0);

  return {
    expected,
    actual,
    difference: actual === undefined ? undefined : actual - expected,
    netInvested,
    gainLoss:
      account.type === "fund" && actual !== undefined
        ? actual - netInvested
        : undefined,
  };
}

export function ledgerSummary(
  ledger: Pick<MonthlyLedger, "accounts" | "entries">,
) {
  const income = ledger.entries
    .filter((entry) => entry.type === "income")
    .reduce(
      (total, entry) =>
        total +
        toPkr(
          entry.amount,
          entry.accountId,
          ledger.accounts,
          entry.exchangeRate,
        ),
      0,
    );
  const expenses = ledger.entries
    .filter((entry) => entry.type === "expense")
    .reduce(
      (total, entry) =>
        total +
        toPkr(
          entry.amount,
          entry.accountId,
          ledger.accounts,
          entry.exchangeRate,
        ),
      0,
    );
  const fundFlow = ledger.entries.reduce((total, entry) => {
    const amount = toPkr(
      entry.amount,
      entry.accountId,
      ledger.accounts,
      entry.exchangeRate,
    );
    if (entry.type === "fund_contribution") return total + amount;
    if (entry.type === "fund_withdrawal") return total - amount;
    if (entry.type === "transfer") {
      const source = ledger.accounts.find(
        (account) => account.id === entry.accountId,
      );
      const destination = ledger.accounts.find(
        (account) => account.id === entry.destinationAccountId,
      );
      const destinationValue = toPkr(
        entry.destinationAmount ?? entry.amount,
        destination?.id ?? "",
        ledger.accounts,
      );
      const inflow = destination?.type === "fund" ? destinationValue : 0;
      const outflow = source?.type === "fund" ? amount : 0;
      return total + inflow - outflow;
    }
    return total;
  }, 0);

  return { income, expenses, netCashFlow: income - expenses, fundFlow };
}

function toPkr(
  amount: number,
  accountId: string,
  accounts: LedgerAccount[],
  exchangeRate?: number,
) {
  const account = accounts.find((item) => item.id === accountId);
  return account?.currency === "USD"
    ? amount * (exchangeRate ?? account.exchangeRate)
    : amount;
}

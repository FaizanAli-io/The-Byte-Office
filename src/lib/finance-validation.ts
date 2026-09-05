import { isMonth, monthBounds } from "@/lib/ledger";
import type { FinanceDoc } from "@/types/finance";
import type { LedgerEntry, MonthlyLedgerPayload } from "@/types/ledger";

export function validateFinanceDoc(
  value: unknown,
): value is Omit<FinanceDoc, "_id"> {
  if (!isRecord(value) || value.name !== "finance") return false;
  if (
    !Array.isArray(value.localBanks) ||
    !Array.isArray(value.remoteBanks) ||
    !Array.isArray(value.mutualFunds)
  ) {
    return false;
  }

  const localValid = value.localBanks.every(
    (item) =>
      isRecord(item) && validName(item.name) && validMoney(item.amountPkr),
  );
  const remoteValid = value.remoteBanks.every(
    (item) =>
      isRecord(item) &&
      validName(item.name) &&
      validMoney(item.amountUsd) &&
      validPositiveNumber(item.exchangeRate),
  );
  const fundsValid = value.mutualFunds.every((group) => {
    if (!isRecord(group)) return false;
    const entries = Object.entries(group);
    if (entries.length !== 1 || !validName(entries[0][0])) return false;
    return (
      Array.isArray(entries[0][1]) &&
      entries[0][1].every(
        (fund) =>
          isRecord(fund) && validName(fund.fund) && validMoney(fund.value),
      )
    );
  });

  return localValid && remoteValid && fundsValid;
}

export function validateSnapshotInput(value: unknown) {
  if (!isRecord(value)) return "Invalid snapshot";
  if (!validateFinanceDoc(value.data)) return "Invalid portfolio data";
  if (!validMoney(value.grandTotal)) return "Invalid portfolio total";
  return null;
}

export function validateLedger(body: MonthlyLedgerPayload) {
  if (!body || !isMonth(body.month)) return "Invalid month";
  if (!["draft", "finalized"].includes(body.status)) return "Invalid status";
  if (!Array.isArray(body.accounts) || !Array.isArray(body.entries)) {
    return "Accounts and entries are required";
  }

  const ids = new Set(body.accounts.map((account) => account.id));
  if (ids.size !== body.accounts.length) return "Account IDs must be unique";

  for (const account of body.accounts) {
    if (!account.id || !validName(account.name)) {
      return "Every account needs a name";
    }
    if (!["bank", "fund"].includes(account.type)) return "Invalid account type";
    if (!["PKR", "USD"].includes(account.currency)) return "Invalid currency";
    if (
      !validMoney(account.openingBalance) ||
      !validMoney(account.exchangeRate) ||
      (account.currency === "USD" && account.exchangeRate === 0)
    ) {
      return "Account balances and exchange rates must be valid";
    }
    if (
      account.type === "fund" &&
      account.openingCostBasis !== undefined &&
      !validMoney(account.openingCostBasis)
    ) {
      return "Fund cost basis must be valid";
    }
    if (
      account.actualClosingBalance !== undefined &&
      !validMoney(account.actualClosingBalance)
    ) {
      return "Actual closing balances must be valid";
    }
  }

  if (
    body.status === "finalized" &&
    body.accounts.some((account) => account.actualClosingBalance === undefined)
  ) {
    return "Enter an actual closing balance for every account before finalizing";
  }

  const bounds = monthBounds(body.month);
  const entryIds = new Set(body.entries.map((entry) => entry.id));
  if (entryIds.size !== body.entries.length) return "Entry IDs must be unique";

  for (const entry of body.entries as LedgerEntry[]) {
    const error = validateLedgerEntry(entry, ids, bounds);
    if (error) return error;

    if (entry.type === "transfer" && entry.destinationAccountId) {
      const source = body.accounts.find(
        (account) => account.id === entry.accountId,
      );
      const destination = body.accounts.find(
        (account) => account.id === entry.destinationAccountId,
      );
      if (
        source?.currency !== destination?.currency &&
        entry.destinationAmount === undefined
      ) {
        return "Cross-currency transfers need a destination amount";
      }
    }
  }

  return null;
}

export function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function validPositiveNumber(value: unknown): value is number {
  return validMoney(value) && value > 0;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateLedgerEntry(
  entry: LedgerEntry,
  accountIds: Set<string>,
  bounds: { min: string; max: string },
) {
  if (
    ![
      "income",
      "expense",
      "transfer",
      "fund_contribution",
      "fund_withdrawal",
    ].includes(entry.type)
  ) {
    return "Invalid entry type";
  }
  if (
    !entry.id ||
    !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
    entry.date < bounds.min ||
    entry.date > bounds.max
  ) {
    return "Every entry must have a valid date in this month";
  }
  if (!accountIds.has(entry.accountId) || !validPositiveNumber(entry.amount)) {
    return "Every entry needs a valid account and positive amount";
  }
  if (
    entry.type === "transfer" &&
    (!entry.destinationAccountId ||
      !accountIds.has(entry.destinationAccountId) ||
      entry.destinationAccountId === entry.accountId)
  ) {
    return "Transfers need two different valid accounts";
  }
  if (
    entry.destinationAmount !== undefined &&
    !validPositiveNumber(entry.destinationAmount)
  ) {
    return "Destination amount must be positive";
  }
  if (
    entry.exchangeRate !== undefined &&
    !validPositiveNumber(entry.exchangeRate)
  ) {
    return "Entry exchange rate must be positive";
  }
  return null;
}

export type LedgerCurrency = "PKR" | "USD";
export type LedgerStatus = "draft" | "finalized";
export type LedgerAccountType = "bank" | "fund";
export type LedgerEntryType =
  | "income"
  | "expense"
  | "transfer"
  | "fund_contribution"
  | "fund_withdrawal";

export interface LedgerAccount {
  id: string;
  name: string;
  type: LedgerAccountType;
  currency: LedgerCurrency;
  openingBalance: number;
  openingCostBasis?: number;
  actualClosingBalance?: number;
  exchangeRate: number;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: LedgerEntryType;
  accountId: string;
  destinationAccountId?: string;
  amount: number;
  destinationAmount?: number;
  exchangeRate?: number;
  category?: string;
  note?: string;
}

export interface MonthlyLedger {
  _id?: string;
  month: string;
  status: LedgerStatus;
  accounts: LedgerAccount[];
  entries: LedgerEntry[];
  createdAt: Date | string;
  updatedAt: Date | string;
  finalizedAt?: Date | string;
}

export type MonthlyLedgerPayload = Omit<
  MonthlyLedger,
  "_id" | "createdAt" | "updatedAt"
>;

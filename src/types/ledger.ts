export type LedgerCurrency = 'PKR' | 'USD';
export type LedgerStatus = 'draft' | 'finalized';
export type LedgerAccountType = 'bank' | 'fund';
export const LEDGER_ENTRY_TYPES = [
  'income',
  'expense',
  'transfer',
  'fund_contribution',
  'fund_withdrawal',
  'hold_received',
  'hold_returned',
] as const;

export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export const CATEGORY_KINDS = ['income', 'expense', 'both'] as const;

export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export interface LedgerCategory {
  id: string;
  name: string;
  kind: CategoryKind;
  sortOrder: number;
  archivedAt?: string | null;
  entryCount: number;
}

export interface LedgerAccount {
  id: string;
  holdingId?: string;
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
  categoryId?: string;
  counterparty?: string;
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

export type MonthlyLedgerPayload = Omit<MonthlyLedger, '_id' | 'createdAt'>;

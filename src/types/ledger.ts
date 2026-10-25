type LedgerStatus = 'draft' | 'finalized';
type LedgerAccountType = 'bank' | 'fund';
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
  // ISO 4217 code, from the account's holding.
  currency: string;
  openingBalance: number;
  openingCostBasis?: number;
  actualClosingBalance?: number;
  // PKR per unit, read-only: live while the month is a draft, frozen when it is finalized.
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
  // Stamped by the server at write time; client values are ignored.
  exchangeRate?: number;
  categoryId?: string;
  counterparty?: string;
  note?: string;
}

export interface MonthlyLedger {
  id: string;
  month: string;
  status: LedgerStatus;
  accounts: LedgerAccount[];
  entries: LedgerEntry[];
  createdAt: Date | string;
  updatedAt: Date | string;
  finalizedAt?: Date | string;
}

export type LedgerDraft = Omit<MonthlyLedger, 'id' | 'createdAt'>;

export type MonthlyLedgerPayload = Omit<LedgerDraft, 'entries'>;

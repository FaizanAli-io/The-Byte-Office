export type LedgerCurrency = 'PKR' | 'USD';
export type LedgerStatus = 'draft' | 'finalized';
export type LedgerAccountType = 'bank' | 'fund';
/**
 * The entry types, declared once. The database enum, the runtime validator, the
 * agent's zod schema and the UI label map all derive from this list, because
 * five separate copies is how one of them ends up missing a type.
 *
 * `hold_received` and `hold_returned` are cash movements that are not yours:
 * money someone hands you to keep for them, and the same money going back.
 * They move the account balance like any other entry, so reconciliation still
 * works, but they stay out of income and expenses.
 */
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
  /** Who the money belongs to. Only meaningful on the two hold types. */
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

export type MonthlyLedgerPayload = Omit<MonthlyLedger, '_id' | 'createdAt' | 'updatedAt'>;

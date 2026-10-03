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

/**
 * What a category may be attached to. `both` is the default, because most
 * categories are honestly either — "transfer fee" is an expense, "salary" is
 * income, but "travel" can be both a cost and a reimbursement. The kind only
 * narrows the picker; it never rejects an entry.
 */
export const CATEGORY_KINDS = ['income', 'expense', 'both'] as const;

export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export interface LedgerCategory {
  id: string;
  name: string;
  kind: CategoryKind;
  sortOrder: number;
  /** Set when the category has left the picker but still names old entries. */
  archivedAt?: string | null;
  /**
   * How many ledger entries reference it, across every month. Derived rather
   * than stored, and the number that decides whether it can be deleted.
   */
  entryCount: number;
}

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
  categoryId?: string;
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

/** `updatedAt` is the version the client read; a save against any other is rejected. */
export type MonthlyLedgerPayload = Omit<MonthlyLedger, '_id' | 'createdAt'>;

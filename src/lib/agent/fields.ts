import { z } from 'zod/v4';
import { CATEGORY_KINDS, LEDGER_ENTRY_TYPES } from '@/types/ledger';
import { HOLDING_KINDS } from '@/types/finance';

export const empty = z.object({});
export const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM')
  .describe('Ledger month as YYYY-MM');
export const entrySerial = z
  .string()
  .regex(/^\d{4,}$/, 'Use a ledger serial such as 0001')
  .describe('Zero-padded serial from ledger_get, such as 0001');
export const holdingKindSchema = z.enum(HOLDING_KINDS);
export const entryTypeSchema = z.enum(LEDGER_ENTRY_TYPES);
export const entryType = entryTypeSchema;
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('ISO date YYYY-MM-DD within the ledger month');

export const categoryName = z.string().trim().min(1).describe('Category name, as categories_list reports it');
export const categoryId = z.string().trim().min(1).describe('Category id from categories_list');
export const categoryKind = z.enum(CATEGORY_KINDS).describe('Which entry types may use it: income, expense, or both');

export const holdingFields = {
  name: z.string().trim().min(1).describe('Bank or fund name'),
  group: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe("A mutual fund's bank; required for funds, omitted otherwise"),
  amount: z.number().nonnegative().describe('Balance in its currency: USD for a remote bank, otherwise PKR'),
  exchangeRate: z.number().positive().optional().describe('PKR per 1 USD; remote banks only'),
};

export const ledgerEntryFields = {
  date: isoDate.optional(),
  type: entryType.optional(),
  accountId: z.string().trim().min(1).optional().describe('Stable account UUID when known'),
  accountName: z.string().trim().min(1).optional().describe('Account name or shorthand, such as TBO'),
  destinationAccountId: z.string().trim().min(1).nullable().optional(),
  amount: z.number().positive().optional(),
  destinationAmount: z.number().positive().nullable().optional(),
  exchangeRate: z.number().positive().nullable().optional(),
  category: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe('Category name from categories_list. An unknown or ambiguous name is rejected; null clears it'),
  counterparty: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe('Whose money this is. Only for hold_received and hold_returned'),
  note: z.string().trim().min(1).nullable().optional(),
};

export const entryRef = {
  month,
  entrySerial: entrySerial.optional(),
  entryId: z.string().trim().min(1).optional().describe('Internal entry UUID'),
};

export const accountFields = {
  name: z.string().trim().min(1).optional().describe('Account name'),
  openingBalance: z
    .number()
    .nonnegative()
    .optional()
    .describe("Balance at the start of the month, in the account's currency"),
  actualClosingBalance: z
    .number()
    .nonnegative()
    .nullable()
    .optional()
    .describe('Statement balance at month end (current market value for funds); null clears it'),
  openingCostBasis: z
    .number()
    .nonnegative()
    .nullable()
    .optional()
    .describe('Funds only: cash invested at month start, not the market value; null clears it'),
  exchangeRate: z.number().positive().optional().describe('PKR per 1 USD. USD accounts only'),
};

export const accountRef = {
  month,
  accountId: z.string().trim().min(1).optional().describe('Account id from ledger_accounts_list'),
  accountName: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Account name or shorthand, when it matches exactly one account'),
};

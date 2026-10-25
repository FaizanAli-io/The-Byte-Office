import { z } from 'zod/v4';
import { CATEGORY_KINDS, LEDGER_ENTRY_TYPES } from '@/types/ledger';
import { DATE_PATTERN, ENTRY_SORT_DIRS, ENTRY_SORT_KEYS, MONTH_PATTERN } from '@/lib/ledger';
import { HOLDING_KINDS } from '@/types/finance';

export const empty = z.object({});
export const text = z.string().trim().min(1);
export const month = z.string().regex(MONTH_PATTERN, 'Month must be YYYY-MM').describe('Ledger month as YYYY-MM');
export const entrySerial = z
  .string()
  .regex(/^\d{4,}$/, 'Use a ledger serial such as 0001')
  .describe('Zero-padded serial from ledger_get, such as 0001');
export const holdingKindSchema = z.enum(HOLDING_KINDS);
export const entryTypeSchema = z.enum(LEDGER_ENTRY_TYPES);
const isoDate = z.string().regex(DATE_PATTERN).describe('ISO date YYYY-MM-DD within the ledger month');

export const holdingId = text.describe('Holding id from portfolio_get');
export const metricId = text.describe('Metric id from health_metrics_list');
export const categoryName = z
  .string()
  .trim()
  .min(1, 'A category needs a name')
  .max(60, 'Category name is too long')
  .describe('Category name, as categories_list reports it');
export const categoryId = text.describe('Category id from categories_list');
export const categoryKind = z.enum(CATEGORY_KINDS).describe('Which entry types may use it: income, expense, or both');

// Shared by the categories API and the category tools.
export const categoryInputSchema = z.object({ name: categoryName, kind: categoryKind.default('both') });
export const categoryChangesSchema = z.object({
  id: categoryId,
  name: categoryName.optional().describe('New name'),
  kind: categoryKind.optional(),
  archived: z.boolean().optional().describe('True to archive, false to restore'),
});

const bounded = (label: string, max: number) => z.string().trim().max(max, `${label} is too long`);

// The contact form and tbo_send_inquiry. Blank optional fields are dropped by parseInquiry.
export const inquirySchema = z.object({
  name: bounded('A name', 120).min(1, 'A name is required'),
  email: bounded('An email', 254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'A valid email is required'),
  company: bounded('Company', 160).optional(),
  service: bounded('Service', 80).optional(),
  message: bounded('A message', 5_000).min(1, 'A message is required'),
});

export const currencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Use a three-letter ISO currency code such as USD')
  .describe('ISO 4217 code such as USD or GBP; see exchange_rates_get for the supported ones');

export const holdingFields = {
  name: text.describe('Bank or fund name'),
  group: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe("A mutual fund's bank; required for funds, omitted otherwise"),
  amount: z.number().nonnegative().describe("Balance in the holding's own currency"),
};

export const ledgerEntryFields = {
  date: isoDate.optional(),
  type: entryTypeSchema.optional(),
  accountId: text.optional().describe('Stable account UUID when known'),
  accountName: text.optional().describe('Account name or shorthand, such as TBO'),
  destinationAccountId: text.nullable().optional().describe('Transfers only: the receiving account UUID'),
  destinationAccountName: text.optional().describe('Transfers only: the receiving account by name or shorthand'),
  amount: z
    .number()
    .positive()
    .optional()
    .describe("In the account's currency. When adding a transfer, the amount sent from the source account"),
  destinationAmount: z
    .number()
    .positive()
    .nullable()
    .optional()
    .describe(
      "Transfers only: the amount received, in the destination's currency. Required across currencies; defaults to the amount sent otherwise"
    ),
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
  note: text.nullable().optional(),
};

// The same filters and sort as the ledger page's entry panel.
export const entryFilterFields = {
  accountId: text.optional().describe('Only entries touching this account id, as source or transfer destination'),
  accountName: text.optional().describe('Account name or shorthand, when it matches exactly one account'),
  type: entryTypeSchema.optional(),
  category: categoryName.optional(),
  categoryId: categoryId.optional(),
  query: text
    .optional()
    .describe('Case-insensitive text matched against category, counterparty, note and account names'),
  dateFrom: isoDate.optional().describe('Earliest entry date, YYYY-MM-DD, inclusive'),
  dateTo: isoDate.optional().describe('Latest entry date, YYYY-MM-DD, inclusive'),
  sortBy: z.enum(ENTRY_SORT_KEYS).optional().describe('Defaults to date'),
  sortDir: z.enum(ENTRY_SORT_DIRS).optional().describe('Defaults to desc, newest first'),
};

export const entryRef = {
  month,
  entrySerial: entrySerial.optional(),
  entryId: text.optional().describe('Internal entry UUID'),
};

export const accountFields = {
  name: text.optional().describe('Account name'),
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
};

export const accountRef = {
  month,
  accountId: text.optional().describe('Account id from ledger_accounts_list'),
  accountName: text.optional().describe('Account name or shorthand, when it matches exactly one account'),
};

import { z } from 'zod/v4';

export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM')
  .describe('Ledger month as YYYY-MM');

export const entrySerialSchema = z
  .string()
  .regex(/^\d{4,}$/, 'Use a ledger serial such as 0001')
  .describe('Zero-padded serial from ledger_get, such as 0001');

export const itemTypeSchema = z.enum(['local_bank', 'remote_bank', 'mutual_fund']);

export const entryTypeSchema = z.enum(['income', 'expense', 'transfer', 'fund_contribution', 'fund_withdrawal']);

export const snapshotIdSchema = z.object({
  id: z.string().min(1).describe('Stable snapshot ID'),
});

export const ledgerGetSchema = z.object({
  month: monthSchema,
});

export const portfolioItemAddSchema = z.discriminatedUnion('itemType', [
  z.object({
    itemType: z.literal('local_bank'),
    name: z.string().min(1).describe('Holding name'),
    amountPkr: z.number().nonnegative().describe('Balance in PKR'),
  }),
  z.object({
    itemType: z.literal('remote_bank'),
    name: z.string().min(1).describe('Holding name'),
    amountUsd: z.number().nonnegative().describe('Balance in USD'),
    exchangeRate: z.number().positive().describe('PKR per 1 USD'),
  }),
  z.object({
    itemType: z.literal('mutual_fund'),
    bankName: z.string().min(1),
    fundName: z.string().min(1),
    value: z.number().nonnegative().describe('Current value in PKR'),
  }),
]);

export const portfolioItemUpdateSchema = z.object({
  itemType: itemTypeSchema,
  id: z.string().min(1).describe('Stable portfolio item ID'),
  name: z.string().min(1).optional(),
  amountPkr: z.number().nonnegative().optional(),
  amountUsd: z.number().nonnegative().optional(),
  exchangeRate: z.number().positive().optional(),
  bankName: z.string().min(1).optional(),
  fundName: z.string().min(1).optional(),
  value: z.number().nonnegative().optional(),
});

export const portfolioItemRemoveSchema = z.object({
  itemType: itemTypeSchema,
  id: z.string().min(1).describe('Stable portfolio item ID'),
});

const ledgerAccountFields = {
  accountId: z.string().min(1).optional().describe('Stable account UUID when known'),
  accountName: z.string().min(1).optional().describe('Account name or shorthand, such as TBO'),
};

export const ledgerEntryAddSchema = z
  .object({
    month: monthSchema,
    type: entryTypeSchema,
    amount: z.number().positive(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe('ISO date YYYY-MM-DD within the ledger month'),
    destinationAccountId: z.string().min(1).optional(),
    destinationAmount: z.number().positive().optional(),
    exchangeRate: z.number().positive().optional(),
    category: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
    ...ledgerAccountFields,
  })
  .refine((value) => Boolean(value.accountId || value.accountName), {
    message: 'Provide accountId or accountName',
    path: ['accountId'],
  });

export const ledgerEntryUpdateSchema = z.object({
  month: monthSchema,
  entrySerial: entrySerialSchema,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  type: entryTypeSchema.optional(),
  amount: z.number().positive().optional(),
  destinationAccountId: z.string().min(1).nullable().optional(),
  destinationAmount: z.number().positive().nullable().optional(),
  exchangeRate: z.number().positive().nullable().optional(),
  category: z.string().min(1).nullable().optional(),
  note: z.string().min(1).nullable().optional(),
  ...ledgerAccountFields,
});

export const ledgerEntryRemoveSchema = z.object({
  month: monthSchema,
  entrySerial: entrySerialSchema,
});

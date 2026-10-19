import { z } from 'zod/v4';
import { ApiError, jsonBody, parseWith } from '@/lib/api';
import { entryFilterFields } from '@/lib/agent/fields';
import {
  applyEntryFilters,
  emptyFilters,
  isMonth,
  resolveAccountId,
  resolveCategoryId,
  type EntryFilters,
} from '@/lib/ledger';
import type { LedgerCategory, LedgerEntry, MonthlyLedger } from '@/types/ledger';
import { listCategories, loadLedger, writeLedgerEntry, type EntryWrite } from '@/lib/db/queries';
import { validateLedger } from '@/lib/finance-validation';

export async function changeLedgerEntry(month: string, write: EntryWrite) {
  const [ledger, categories] = await Promise.all([loadLedger(month), listCategories()]);
  if (!ledger) throw new ApiError('Ledger not found', 404);
  if (ledger.status === 'finalized') throw new ApiError('Finalized ledgers cannot be edited', 409);

  const id = write.kind === 'remove' ? write.id : write.entry.id;
  const exists = ledger.entries.some((entry) => entry.id === id);
  if (write.kind === 'add' && exists) throw new ApiError('This entry was already added', 409);
  if (write.kind !== 'add' && !exists) throw new ApiError('Ledger entry not found', 404);

  const entries =
    write.kind === 'add'
      ? [...ledger.entries, write.entry]
      : write.kind === 'update'
        ? ledger.entries.map((entry) => (entry.id === id ? write.entry : entry))
        : ledger.entries.filter((entry) => entry.id !== id);
  const error = validateLedger({ ...ledger, entries }, new Set(categories.map((category) => category.id)));
  if (error) throw new ApiError(error);

  const saved = await writeLedgerEntry(ledger, write);
  if (!saved) throw new ApiError('Finalized ledgers cannot be edited', 409);
  return saved;
}

export function requireMonth(month: string | null | undefined) {
  if (!month || !isMonth(month)) throw new ApiError('Invalid month');
  return month;
}

export async function readEntryBody(req: Request) {
  const body = await jsonBody<{ month?: string; entry?: LedgerEntry }>(req);
  const month = requireMonth(body.month);
  if (!body.entry || typeof body.entry !== 'object') throw new ApiError('entry is required');
  return { month, entry: body.entry };
}

const entryFilterSchema = z.object(entryFilterFields);

// Server-side filter and sort for the ledger page, GET /api/ledger and ledger_get; newest first by default.
export function filterLedgerEntries(ledger: MonthlyLedger, categoryList: LedgerCategory[], params: unknown) {
  const { accountId, accountName, category, categoryId, ...rest } = parseWith(entryFilterSchema, params);
  const account = accountId ?? resolveAccountId(ledger.accounts, accountName);
  if (accountName && !account) throw new ApiError('accountName matches no single account in this ledger');
  const wanted = category?.toLowerCase();
  const categoryMatch =
    categoryId ??
    (wanted &&
      (categoryList.find((item) => item.name.toLowerCase() === wanted)?.id ??
        resolveCategoryId(categoryList, category)));
  if (category && !categoryMatch) throw new ApiError('category matches no single category; see categories_list');

  const filters: EntryFilters = {
    ...emptyFilters,
    ...Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)),
    ...(account ? { accountId: account } : {}),
    ...(categoryMatch ? { category: categoryMatch } : {}),
  };
  return applyEntryFilters(ledger.entries, filters, ledger.accounts, categoryList);
}

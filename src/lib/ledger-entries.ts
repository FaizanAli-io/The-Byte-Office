import { randomUUID } from 'crypto';
import { z } from 'zod/v4';
import { ApiError, jsonBody, parseWith } from '@/lib/api';
import { entryFilterFields } from '@/lib/agent/fields';
import { ratesFor, requireRate } from '@/lib/exchange-rates';
import { PKR, splitTransfer, TRANSFER_CATEGORIES } from '@/lib/fx';
import {
  applyEntryFilters,
  emptyFilters,
  isMonth,
  resolveAccountId,
  resolveCategoryId,
  type EntryFilters,
} from '@/lib/ledger';
import type { LedgerCategory, LedgerEntry, MonthlyLedger } from '@/types/ledger';
import { ensureCategory, listCategories, loadLedger, writeLedgerEntries, type EntryChanges } from '@/lib/db/queries';
import { validateLedger, validPositiveNumber } from '@/lib/finance-validation';

// Adding a transfer: entry.amount is what was sent and entry.destinationAmount what arrived. Any other write, an
// edit of a transfer included, saves the entry as given.
export type EntryWrite = { kind: 'add' | 'update'; entry: LedgerEntry } | { kind: 'remove'; id: string };

export async function changeLedgerEntry(month: string, write: EntryWrite) {
  const [ledger, categories] = await Promise.all([loadLedger(month), listCategories()]);
  if (!ledger) throw new ApiError('Ledger not found', 404);
  if (ledger.status === 'finalized') throw new ApiError('Finalized ledgers cannot be edited', 409);

  const id = write.kind === 'remove' ? write.id : write.entry.id;
  const current = ledger.entries.find((entry) => entry.id === id);
  if (write.kind === 'add' && current) throw new ApiError('This entry was already added', 409);
  if (write.kind !== 'add' && !current) throw new ApiError('Ledger entry not found', 404);

  const changes: EntryChanges = { insert: [], update: [], remove: [] };
  if (write.kind === 'remove') changes.remove.push(id);
  else if (write.kind === 'update') changes.update.push(await stamp(write.entry, current, ledger));
  else changes.insert.push(...(await addedEntries(await stamp(write.entry, undefined, ledger), ledger)));

  const touched = new Map(changes.update.map((entry) => [entry.id, entry]));
  const entries = [
    ...ledger.entries
      .filter((entry) => !changes.remove.includes(entry.id))
      .map((entry) => touched.get(entry.id) ?? entry),
    ...changes.insert,
  ];
  const categoryIds = new Set([
    ...categories.map((category) => category.id),
    ...entries.flatMap((e) => e.categoryId ?? []),
  ]);
  const error = validateLedger({ ...ledger, entries }, categoryIds);
  if (error) throw new ApiError(error);

  const saved = await writeLedgerEntries(ledger, changes);
  if (!saved) throw new ApiError('Finalized ledgers cannot be edited', 409);
  return saved;
}

const currencyOf = (ledger: MonthlyLedger, accountId?: string) =>
  ledger.accounts.find((account) => account.id === accountId)?.currency ?? PKR;

// The server stamps the rate an entry is valued at; an edit keeps the original one while the account is unchanged.
async function stamp(input: LedgerEntry, previous: LedgerEntry | undefined, ledger: MonthlyLedger) {
  const { exchangeRate: _rate, ...fields } = input;
  const entry: LedgerEntry =
    fields.type === 'transfer' ? fields : { ...fields, destinationAccountId: undefined, destinationAmount: undefined };
  const kept = previous?.accountId === entry.accountId ? previous.exchangeRate : undefined;
  const currency = currencyOf(ledger, entry.accountId);
  return { ...entry, exchangeRate: kept ?? requireRate(await ratesFor([currency]), currency) };
}

// A new transfer becomes what arrived plus, when the amounts differ, a separate cost, gain or fee on the source.
async function addedEntries(entry: LedgerEntry, ledger: MonthlyLedger): Promise<LedgerEntry[]> {
  if (entry.type !== 'transfer') return [entry];
  const source = currencyOf(ledger, entry.accountId);
  const destination = currencyOf(ledger, entry.destinationAccountId);
  const sent = entry.amount;
  const received = entry.destinationAmount ?? (source === destination ? sent : undefined);
  if (received === undefined) throw new ApiError('Cross-currency transfers need the amount received');
  if (!validPositiveNumber(sent) || !validPositiveNumber(received)) {
    throw new ApiError('A transfer needs a positive amount sent and received');
  }
  const split = splitTransfer({
    sent,
    received,
    source: { currency: source, rate: entry.exchangeRate! },
    destination: { currency: destination, rate: requireRate(await ratesFor([destination]), destination) },
  });
  if ('error' in split) throw new ApiError(split.error);

  const transfer = { ...entry, amount: split.amount, destinationAmount: received };
  if (!split.difference) return [transfer];
  return [
    transfer,
    {
      id: randomUUID(),
      date: transfer.date,
      type: split.difference.type,
      accountId: transfer.accountId,
      amount: split.difference.amount,
      exchangeRate: transfer.exchangeRate,
      categoryId: await ensureCategory(TRANSFER_CATEGORIES[split.difference.category]),
      note: split.difference.note,
    },
  ];
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

import { ApiError, jsonBody } from '@/lib/api';
import { isMonth } from '@/lib/ledger';
import type { LedgerEntry } from '@/types/ledger';
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

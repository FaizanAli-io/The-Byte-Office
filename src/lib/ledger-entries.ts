import { AgentActionError } from '@/lib/agent/action-utils';
import { ApiError, jsonBody } from '@/lib/api';
import { isMonth } from '@/lib/ledger';
import type { LedgerEntry } from '@/types/ledger';
import { listCategories, loadLedger, writeLedgerEntry, type EntryWrite } from '@/lib/db/queries';
import { validateLedger } from '@/lib/finance-validation';

export async function changeLedgerEntry(month: string, write: EntryWrite) {
  const [ledger, categories] = await Promise.all([loadLedger(month), listCategories()]);
  if (!ledger) throw new AgentActionError('Ledger not found', 404);
  if (ledger.status === 'finalized') throw new AgentActionError('Finalized ledgers cannot be edited', 409);

  const id = write.kind === 'remove' ? write.id : write.entry.id;
  const exists = ledger.entries.some((entry) => entry.id === id);
  if (write.kind === 'add' && exists) throw new AgentActionError('This entry was already added', 409);
  if (write.kind !== 'add' && !exists) throw new AgentActionError('Ledger entry not found', 404);

  const entries =
    write.kind === 'add'
      ? [...ledger.entries, write.entry]
      : write.kind === 'update'
        ? ledger.entries.map((entry) => (entry.id === id ? write.entry : entry))
        : ledger.entries.filter((entry) => entry.id !== id);
  const error = validateLedger({ ...ledger, entries }, new Set(categories.map((category) => category.id)));
  if (error) throw new AgentActionError(error);

  const saved = await writeLedgerEntry(ledger, write);
  if (!saved) throw new AgentActionError('Finalized ledgers cannot be edited', 409);
  return saved;
}

export async function readEntryBody(req: Request) {
  const { month, entry } = await jsonBody<{ month?: string; entry?: LedgerEntry }>(req);
  if (!month || !isMonth(month)) throw new ApiError('Invalid month');
  if (!entry || typeof entry !== 'object') throw new ApiError('entry is required');
  return { month, entry };
}

import { ApiError, apiRoute, created } from '@/lib/api';
import { isUuid } from '@/lib/db/ids';
import { changeLedgerEntry, readEntryBody } from '@/lib/ledger-entries';

export const POST = apiRoute('POST /api/ledger/entries', 'Failed to add ledger entry', async (req: Request) => {
  const { month, entry } = await readEntryBody(req);
  if (!isUuid(entry.id)) throw new ApiError('entry.id must be a UUID');
  return created(await changeLedgerEntry(month, { kind: 'add', entry }));
});

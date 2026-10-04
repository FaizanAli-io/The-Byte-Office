import { ApiError, apiRoute, searchParam } from '@/lib/api';
import { isUuid } from '@/lib/db/ids';
import { isMonth } from '@/lib/ledger';
import { changeLedgerEntry, readEntryBody } from '@/lib/ledger-entries';

type Context = { params: Promise<{ id: string }> };

async function entryId(ctx: Context) {
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new ApiError('Ledger entry not found', 404);
  return id;
}

export const PUT = apiRoute(
  'PUT /api/ledger/entries/[id]',
  'Failed to update ledger entry',
  async (req: Request, ctx: Context) => {
    const id = await entryId(ctx);
    const { month, entry } = await readEntryBody(req);
    return changeLedgerEntry(month, { kind: 'update', entry: { ...entry, id } });
  }
);

export const DELETE = apiRoute(
  'DELETE /api/ledger/entries/[id]',
  'Failed to delete ledger entry',
  async (req: Request, ctx: Context) => {
    const id = await entryId(ctx);
    const month = searchParam(req, 'month');
    if (!month || !isMonth(month)) throw new ApiError('Invalid month');
    return changeLedgerEntry(month, { kind: 'remove', id });
  }
);

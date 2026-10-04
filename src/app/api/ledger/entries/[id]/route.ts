import { ApiError, apiRoute, searchParam, type IdContext } from '@/lib/api';
import { isUuid } from '@/lib/db/ids';
import { changeLedgerEntry, readEntryBody, requireMonth } from '@/lib/ledger-entries';

async function entryId(ctx: IdContext) {
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new ApiError('Ledger entry not found', 404);
  return id;
}

export const PUT = apiRoute(
  'PUT /api/ledger/entries/[id]',
  'Failed to update ledger entry',
  async (req: Request, ctx: IdContext) => {
    const id = await entryId(ctx);
    const { month, entry } = await readEntryBody(req);
    return changeLedgerEntry(month, { kind: 'update', entry: { ...entry, id } });
  }
);

export const DELETE = apiRoute(
  'DELETE /api/ledger/entries/[id]',
  'Failed to delete ledger entry',
  async (req: Request, ctx: IdContext) => {
    const id = await entryId(ctx);
    return changeLedgerEntry(requireMonth(searchParam(req, 'month')), { kind: 'remove', id });
  }
);

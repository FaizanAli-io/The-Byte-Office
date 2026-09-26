import { createSnapshot, deleteSnapshot, listSnapshots } from '@/lib/db/queries';
import { validateSnapshotInput } from '@/lib/finance-validation';
import { ApiError, apiRoute, found, jsonBody } from '@/lib/api';
import type { FinanceDoc } from '@/types/finance';

export const GET = apiRoute('GET /api/snapshots', 'Failed to fetch snapshots', () => listSnapshots());

export const POST = apiRoute('POST /api/snapshots', 'Failed to create snapshot', async (req: Request) => {
  const body = await jsonBody<unknown>(req);
  const validationError = validateSnapshotInput(body);
  if (validationError) throw new ApiError(validationError);

  const { data, grandTotal } = body as { data: FinanceDoc; grandTotal: number };

  // A snapshot records values at a point in time, so live holding IDs are
  // stripped: the rows they point at can be edited or deleted later.
  const id = await createSnapshot(
    {
      name: data.name,
      mutualFunds: data.mutualFunds.map((group) => {
        const bank = Object.keys(group)[0];
        return { [bank]: (group[bank] ?? []).map(({ fund, value }) => ({ fund, value })) };
      }),
      remoteBanks: data.remoteBanks.map(({ name, amountUsd, exchangeRate }) => ({ name, amountUsd, exchangeRate })),
      localBanks: data.localBanks.map(({ name, amountPkr }) => ({ name, amountPkr })),
    },
    grandTotal
  );

  return { success: true, id };
});

export const DELETE = apiRoute('DELETE /api/snapshots', 'Failed to delete snapshot', async (req: Request) => {
  const { id } = await jsonBody<{ id?: string }>(req);
  if (!id) throw new ApiError('Missing snapshot id');
  found((await deleteSnapshot(id)) || null, 'Snapshot not found');
  return { success: true };
});

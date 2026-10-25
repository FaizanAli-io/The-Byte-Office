import { createSnapshot, deleteSnapshot, listSnapshots } from '@/lib/db/queries';
import { priceHoldings } from '@/lib/db/portfolio';
import { portfolioTotals } from '@/lib/finance';
import { parseSnapshotInput } from '@/lib/finance-validation';
import { ApiError, apiRoute, bodyId, found, jsonBody } from '@/lib/api';

export const GET = apiRoute('GET /api/snapshots', 'Failed to fetch snapshots', () => listSnapshots());

export const POST = apiRoute('POST /api/snapshots', 'Failed to create snapshot', async (req: Request) => {
  const input = parseSnapshotInput(await jsonBody<unknown>(req));
  if (typeof input === 'string') throw new ApiError(input);
  // Frozen at the live rates of the moment; any rate the client sent is ignored.
  const holdings = await priceHoldings(input);
  return { success: true, id: await createSnapshot(holdings, portfolioTotals(holdings).grandTotal) };
});

export const DELETE = apiRoute('DELETE /api/snapshots', 'Failed to delete snapshot', async (req: Request) => {
  found((await deleteSnapshot(await bodyId(req, 'snapshot'))) || null, 'Snapshot not found');
  return { success: true };
});

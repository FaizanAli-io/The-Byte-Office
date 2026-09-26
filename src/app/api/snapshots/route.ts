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
  return { success: true, id: await createSnapshot(data, grandTotal) };
});

export const DELETE = apiRoute('DELETE /api/snapshots', 'Failed to delete snapshot', async (req: Request) => {
  const { id } = await jsonBody<{ id?: string }>(req);
  if (!id) throw new ApiError('Missing snapshot id');
  found((await deleteSnapshot(id)) || null, 'Snapshot not found');
  return { success: true };
});

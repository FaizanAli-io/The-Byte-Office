import { loadHoldMovements } from '@/lib/db/queries';
import { heldFunds } from '@/lib/ledger';
import { apiRoute } from '@/lib/api';

export const GET = apiRoute('GET /api/held-funds', 'Failed to load held funds', async () => {
  const movements = await loadHoldMovements();
  return { ...heldFunds(movements), movements };
});

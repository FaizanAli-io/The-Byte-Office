import { loadHoldMovements } from '@/lib/db/queries';
import { heldFunds } from '@/lib/ledger';
import { apiRoute } from '@/lib/api';

/**
 * What is currently being held for other people, derived from the ledger's
 * hold entries rather than stored anywhere.
 *
 * The dated movements come back with the totals so a caller can also ask what
 * was outstanding at some earlier moment — a snapshot's timestamp, say —
 * without a second round trip or a second copy of the arithmetic.
 */
export const GET = apiRoute('GET /api/held-funds', 'Failed to load held funds', async () => {
  const movements = await loadHoldMovements();
  return { ...heldFunds(movements), movements };
});

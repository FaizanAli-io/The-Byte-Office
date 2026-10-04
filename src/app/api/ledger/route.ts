import { isMonth } from '@/lib/ledger';
import { validateLedger } from '@/lib/finance-validation';
import { createLedger, listCategories, loadLedger, loadPreviousLedger, listLedgerSummaries } from '@/lib/db/queries';
import { ApiError, apiRoute, created, found, jsonBody, searchParam } from '@/lib/api';
import { loadHoldingIdentities, saveLedgerSynced } from '@/lib/db/portfolio';
import { accountsForNewMonth } from '@/lib/accounts';
import type { MonthlyLedgerPayload } from '@/types/ledger';

export const GET = apiRoute('GET /api/ledger', 'Failed to load ledger', async (req: Request) => {
  const month = searchParam(req, 'month');
  if (!month) return listLedgerSummaries();
  if (!isMonth(month)) throw new ApiError('Invalid month');
  return found(await loadLedger(month), 'Ledger not found');
});

export const POST = apiRoute('POST /api/ledger', 'Failed to create ledger', async (req: Request) => {
  const { month } = await jsonBody<{ month?: string }>(req);
  if (!month || !isMonth(month)) throw new ApiError('Invalid month');

  const existing = await loadLedger(month);
  if (existing) return existing;

  const [holdings, previous] = await Promise.all([loadHoldingIdentities(), loadPreviousLedger(month)]);
  return created(await createLedger({ month, accounts: accountsForNewMonth(holdings, previous) }));
});

export const PUT = apiRoute('PUT /api/ledger', 'Failed to save ledger', async (req: Request) => {
  const body = await jsonBody<MonthlyLedgerPayload>(req);
  const categoryIds = new Set((await listCategories()).map((category) => category.id));
  const validationError = validateLedger(body, categoryIds);
  if (validationError) throw new ApiError(validationError);

  const existing = found(await loadLedger(body.month), 'Ledger not found');
  if (existing.status === 'finalized' && body.status === 'finalized') {
    throw new ApiError('Reopen this month before editing it', 409);
  }
  return found(
    await saveLedgerSynced(existing, body),
    'This month was changed in another tab. Reload it before saving.',
    409
  );
});

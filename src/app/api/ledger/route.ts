import { isMonth } from '@/lib/ledger';
import { validateLedger } from '@/lib/finance-validation';
import {
  createLedger,
  listCategories,
  loadLedger,
  loadPreviousFinalizedLedger,
  listLedgerSummaries,
} from '@/lib/db/queries';
import { ApiError, apiRoute, created, found, jsonBody, searchParam } from '@/lib/api';
import { loadHoldingList } from '@/lib/db/holdings';
import { saveLedgerSynced } from '@/lib/db/sync';
import { accountsForNewMonth } from '@/lib/portfolio-sync';
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

  // A month opens with an account per holding, at the portfolio's figures.
  const [holdings, previous] = await Promise.all([loadHoldingList(), loadPreviousFinalizedLedger(month)]);
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

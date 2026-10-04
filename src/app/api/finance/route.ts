import { loadFinanceDoc, saveFinanceDoc } from '@/lib/db/holdings';
import { withPortfolioSync } from '@/lib/db/sync';
import { validateFinanceDoc } from '@/lib/finance-validation';
import { ApiError, apiRoute, jsonBody } from '@/lib/api';

export const GET = apiRoute('GET /api/finance', 'Failed to load finance data', () => loadFinanceDoc());

export const POST = apiRoute('POST /api/finance', 'Failed to update finance data', async (req: Request) => {
  const body = await jsonBody<unknown>(req);
  if (!validateFinanceDoc(body)) throw new ApiError('Invalid finance data');
  if ('_id' in body) delete body._id;
  return { success: true, data: await withPortfolioSync(() => saveFinanceDoc(body)) };
});

import { loadFinanceDoc, saveFinanceDoc } from '@/lib/db/queries';
import { validateFinanceDoc } from '@/lib/finance-validation';
import { ApiError, apiRoute, jsonBody } from '@/lib/api';

export const GET = apiRoute('GET /api/finance', 'Failed to load finance data', () => loadFinanceDoc());

export const POST = apiRoute('POST /api/finance', 'Failed to update finance data', async (req: Request) => {
  const body = await jsonBody<unknown>(req);
  if (!validateFinanceDoc(body)) throw new ApiError('Invalid finance data');
  if ('_id' in body) delete body._id;
  // Return the saved document so the editor can adopt the IDs Postgres
  // assigned to newly inserted holdings. Without this the client would still
  // hold ID-less rows and the next save would insert them a second time.
  return { success: true, data: await saveFinanceDoc(body) };
});

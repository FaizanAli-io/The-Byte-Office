import { loadPortfolioHoldings, savePortfolio } from '@/lib/db/portfolio';
import { parsePortfolio } from '@/lib/finance-validation';
import { ApiError, apiRoute, jsonBody } from '@/lib/api';

export const GET = apiRoute('GET /api/finance', 'Failed to load finance data', async () => ({
  holdings: await loadPortfolioHoldings(),
}));

export const POST = apiRoute('POST /api/finance', 'Failed to update finance data', async (req: Request) => {
  const holdings = parsePortfolio(await jsonBody<unknown>(req));
  if (!holdings) throw new ApiError('Invalid portfolio data');
  return { success: true, data: { holdings: await savePortfolio(holdings) } };
});

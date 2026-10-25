import { apiRoute } from '@/lib/api';
import { getExchangeRates } from '@/lib/exchange-rates';

export const GET = apiRoute('GET /api/exchange-rates', 'Failed to load exchange rates', () => getExchangeRates());

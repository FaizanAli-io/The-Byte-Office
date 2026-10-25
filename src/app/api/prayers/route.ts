import { loadPrayerTracker, setPrayer } from '@/lib/db/personal';
import { prayerSetSchema } from '@/lib/personal-validation';
import { apiRoute, jsonBody, parseWith } from '@/lib/api';

export const GET = apiRoute('GET /api/prayers', 'Failed to load prayers', () => loadPrayerTracker());

export const PUT = apiRoute('PUT /api/prayers', 'Failed to set prayer', async (req: Request) =>
  setPrayer(parseWith(prayerSetSchema, await jsonBody(req)))
);

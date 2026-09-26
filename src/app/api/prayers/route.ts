import { createPrayer, isUniqueViolation, listPrayers } from '@/lib/db/personal';
import { prayerInputSchema } from '@/lib/personal-validation';
import { ApiError, apiRoute, created, jsonBody, parseWith } from '@/lib/api';

export const GET = apiRoute('GET /api/prayers', 'Failed to load prayers', () => listPrayers());

export const POST = apiRoute('POST /api/prayers', 'Failed to create prayer', async (req: Request) => {
  const input = parseWith(prayerInputSchema, await jsonBody(req));
  const prayer = await createPrayer(input).catch((cause) => {
    throw isUniqueViolation(cause) ? new ApiError('That namaaz already exists', 409) : cause;
  });
  return created(prayer);
});

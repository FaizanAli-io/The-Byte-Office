import { createPrayer, isUniqueViolation, listPrayers } from '@/lib/db/personal';
import { validatePrayerInput } from '@/lib/personal-validation';
import { ApiError, apiRoute, created, jsonBody, unwrap } from '@/lib/api';

export const GET = apiRoute('GET /api/prayers', 'Failed to load prayers', () => listPrayers());

export const POST = apiRoute('POST /api/prayers', 'Failed to create prayer', async (req: Request) => {
  const input = unwrap(validatePrayerInput(await jsonBody(req)));
  const prayer = await createPrayer(input).catch((cause) => {
    throw isUniqueViolation(cause) ? new ApiError('That namaaz already exists', 409) : cause;
  });
  return created(prayer);
});

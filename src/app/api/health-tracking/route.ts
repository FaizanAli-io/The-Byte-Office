import { createHealthTracking, listHealthTracking } from '@/lib/db/personal';
import { healthInputSchema } from '@/lib/personal-validation';
import { apiRoute, created, jsonBody, parseWith, searchParam } from '@/lib/api';

export const GET = apiRoute('GET /api/health-tracking', 'Failed to load health tracking', (req: Request) =>
  listHealthTracking(searchParam(req, 'metric')?.trim() || undefined)
);

export const POST = apiRoute(
  'POST /api/health-tracking',
  'Failed to create health tracking entry',
  async (req: Request) => created(await createHealthTracking(parseWith(healthInputSchema, await jsonBody(req))))
);

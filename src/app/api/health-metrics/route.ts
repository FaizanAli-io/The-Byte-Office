import { addHealthMetric, listHealthMetrics, removeHealthMetric, renameHealthMetric } from '@/lib/db/personal';
import { healthMetricInputSchema, healthMetricUpdateSchema } from '@/lib/personal-validation';
import { apiRoute, bodyId, created, jsonBody, parseWith } from '@/lib/api';

export const GET = apiRoute('GET /api/health-metrics', 'Failed to load health metrics', () => listHealthMetrics());

export const POST = apiRoute('POST /api/health-metrics', 'Failed to create health metric', async (req: Request) =>
  created(await addHealthMetric(parseWith(healthMetricInputSchema, await jsonBody(req)).name))
);

export const PUT = apiRoute('PUT /api/health-metrics', 'Failed to rename health metric', async (req: Request) => {
  const { id, name } = parseWith(healthMetricUpdateSchema, await jsonBody(req));
  return renameHealthMetric(id, name);
});

export const DELETE = apiRoute('DELETE /api/health-metrics', 'Failed to delete health metric', async (req: Request) => {
  await removeHealthMetric(await bodyId(req, 'health metric'));
  return { success: true };
});

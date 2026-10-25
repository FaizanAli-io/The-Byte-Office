import { deleteHealthTracking, updateHealthTracking } from '@/lib/db/personal';
import { healthUpdateSchema } from '@/lib/personal-validation';
import { apiRoute, found, jsonBody, parseWith, type IdContext } from '@/lib/api';

const NOT_FOUND = 'Health tracking entry not found';

export const PUT = apiRoute(
  'PUT /api/health-tracking/[id]',
  'Failed to update health tracking entry',
  async (req: Request, ctx: IdContext) =>
    found(
      await updateHealthTracking((await ctx.params).id, parseWith(healthUpdateSchema, await jsonBody(req))),
      NOT_FOUND
    )
);

export const DELETE = apiRoute(
  'DELETE /api/health-tracking/[id]',
  'Failed to delete health tracking entry',
  async (_req: Request, ctx: IdContext) => {
    found((await deleteHealthTracking((await ctx.params).id)) || null, NOT_FOUND);
    return { success: true };
  }
);

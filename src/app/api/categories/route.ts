import { addCategory, discardCategory, editCategory } from '@/lib/categories';
import { listCategories } from '@/lib/db/queries';
import { categoryInputSchema, categoryUpdateSchema } from '@/lib/finance-validation';
import { ApiError, apiRoute, created, jsonBody, parseWith } from '@/lib/api';

/**
 * The canonical category list. Archived categories are returned too: they
 * still name historical entries, and a picker that hides them is the caller's
 * job rather than this endpoint's.
 *
 * The rules behind the writes live in `lib/categories.ts`, because the
 * assistant reaches them through the action layer rather than through here.
 */
export const GET = apiRoute('GET /api/categories', 'Failed to load categories', () => listCategories());

export const POST = apiRoute('POST /api/categories', 'Failed to create category', async (req: Request) =>
  created(await addCategory(parseWith(categoryInputSchema, await jsonBody(req))))
);

export const PUT = apiRoute('PUT /api/categories', 'Failed to update category', async (req: Request) => {
  const { id, ...changes } = parseWith(categoryUpdateSchema, await jsonBody(req));
  return editCategory(id, changes);
});

export const DELETE = apiRoute('DELETE /api/categories', 'Failed to delete category', async (req: Request) => {
  const { id } = await jsonBody<{ id?: string }>(req);
  if (!id) throw new ApiError('Missing category id');
  await discardCategory(id);
  return { success: true };
});

import { countCategoryUses, createCategory, deleteCategory, listCategories, updateCategory } from '@/lib/db/queries';
import { categoryInputSchema, categoryUpdateSchema } from '@/lib/finance-validation';
import { ApiError, apiRoute, created, found, jsonBody, parseWith } from '@/lib/api';

/**
 * The canonical category list. Archived categories are returned too: they
 * still name historical entries, and a picker that hides them is the caller's
 * job rather than this endpoint's.
 */
export const GET = apiRoute('GET /api/categories', 'Failed to load categories', () => listCategories());

export const POST = apiRoute('POST /api/categories', 'Failed to create category', async (req: Request) => {
  const input = parseWith(categoryInputSchema, await jsonBody(req));
  const existing = await listCategories();
  if (existing.some((category) => category.name.toLowerCase() === input.name.toLowerCase())) {
    throw new ApiError(`There is already a category called "${input.name}"`, 409);
  }
  return created(await createCategory(input));
});

export const PUT = apiRoute('PUT /api/categories', 'Failed to update category', async (req: Request) => {
  const { id, ...changes } = parseWith(categoryUpdateSchema, await jsonBody(req));
  if (changes.name) {
    const clash = (await listCategories()).find(
      (category) => category.id !== id && category.name.toLowerCase() === changes.name?.toLowerCase()
    );
    if (clash) throw new ApiError(`There is already a category called "${changes.name}"`, 409);
  }
  return found(await updateCategory(id, changes), 'Category not found');
});

/**
 * Deletes a category outright, and refuses when entries still point at it.
 * The foreign key would refuse anyway; catching it here says how many entries
 * are in the way and that archiving is the thing they probably wanted.
 */
export const DELETE = apiRoute('DELETE /api/categories', 'Failed to delete category', async (req: Request) => {
  const { id } = await jsonBody<{ id?: string }>(req);
  if (!id) throw new ApiError('Missing category id');

  const uses = await countCategoryUses(id);
  if (uses) {
    throw new ApiError(`${uses} ${uses === 1 ? 'entry uses' : 'entries use'} this category — archive it instead`, 409);
  }
  found((await deleteCategory(id)) || null, 'Category not found');
  return { success: true };
});

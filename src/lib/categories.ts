import { AgentActionError } from '@/lib/agent/action-utils';
import { countCategoryUses, createCategory, deleteCategory, listCategories, updateCategory } from '@/lib/db/queries';
import type { CategoryKind, LedgerCategory } from '@/types/ledger';

/**
 * The rules about categories that are not the database's job.
 *
 * Two surfaces write categories — the REST route behind the ledger page and
 * the assistant's action layer — and both need the same three answers: a name
 * is unique case-insensitively, a category that entries point at cannot be
 * deleted, and acting on one that does not exist is a 404. Written once here
 * so the two cannot disagree about any of them.
 *
 * `AgentActionError` carries a status, and `apiRoute` maps any error that
 * does, so one error type serves both callers.
 */

export async function addCategory(input: { name: string; kind: CategoryKind }): Promise<LedgerCategory> {
  await assertNameIsFree(input.name);
  return createCategory(input);
}

export async function editCategory(
  id: string,
  changes: { name?: string; kind?: CategoryKind; sortOrder?: number; archived?: boolean }
): Promise<LedgerCategory> {
  if (changes.name) await assertNameIsFree(changes.name, id);
  const updated = await updateCategory(id, changes);
  if (!updated) throw new AgentActionError('Category not found', 404);
  return updated;
}

/**
 * Deletes outright, and refuses while entries still reference it. The foreign
 * key would refuse anyway; catching it here says how many entries are in the
 * way and that archiving is almost certainly what was wanted.
 */
export async function discardCategory(id: string): Promise<void> {
  const uses = await countCategoryUses(id);
  if (uses) {
    throw new AgentActionError(
      `${uses} ${uses === 1 ? 'entry uses' : 'entries use'} this category — archive it instead`,
      409
    );
  }
  if (!(await deleteCategory(id))) throw new AgentActionError('Category not found', 404);
}

async function assertNameIsFree(name: string, exceptId?: string) {
  const clash = (await listCategories()).find(
    (category) => category.id !== exceptId && category.name.toLowerCase() === name.toLowerCase()
  );
  if (clash) throw new AgentActionError(`There is already a category called "${clash.name}"`, 409);
}

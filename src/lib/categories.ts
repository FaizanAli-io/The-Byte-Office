import { AgentActionError } from '@/lib/agent/action-utils';
import { countCategoryUses, createCategory, deleteCategory, listCategories, updateCategory } from '@/lib/db/queries';
import type { CategoryKind, LedgerCategory } from '@/types/ledger';

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

import { ApiError } from '@/lib/api';
import { randomUUID } from 'crypto';
import { assertUnchanged, fingerprint } from '@/lib/agent/action-utils';
import { listCategories } from '@/lib/db/queries';
import { addCategory, discardCategory, editCategory } from '@/lib/categories';
import { resolveCategoryId } from '@/lib/ledger';
import { type CategoryKind, type LedgerCategory, type MonthlyLedger } from '@/types/ledger';
import type { AgentActionPayload, AgentActionType, AgentProposal, PersonalActionType } from '@/lib/agent/types';
import { applyAccountAction, isAccountAction, planAccountAction } from './ledger-accounts';
import { requireLedger } from './tools';
import { changeLedgerEntry } from '@/lib/ledger-entries';
import { addHolding, getHolding, removeHolding, saveLedgerSynced, updateHolding } from '@/lib/db/portfolio';
import {
  applyEntryOverride,
  assertLedger,
  defaultEntryDate,
  definedFields,
  firstAccountId,
  isEntryType,
  ledgerFingerprint,
  ledgerForm,
  ledgerStructureFingerprint,
  parseHolding,
  parseLedgerEntry,
  holdingLabel,
  requireString,
  resolveAccountId,
  resolveEntryId,
  serialFor,
} from './action-parsing';

type FinancePayload = Exclude<AgentActionPayload, { actionType: PersonalActionType | 'tbo_send_inquiry' }>;
type LedgerPayload = Extract<FinancePayload, { actionType: `ledger_${string}` }>;

export async function proposeFinanceAction(
  actionType: AgentActionType,
  args: Record<string, unknown>
): Promise<AgentProposal> {
  if (actionType === 'portfolio_item_add') {
    const item = parseHolding(args);
    return {
      actionType,
      payload: { actionType, item },
      preview: { title: `Add ${holdingLabel(item.kind)}`, after: item },
    };
  }

  if (actionType === 'portfolio_item_update' || actionType === 'portfolio_item_remove') {
    const id = args.id as string;
    const current = await getHolding(id);
    if (!current) throw new ApiError('Holding not found. Call portfolio_get for the ids.', 404);

    if (actionType === 'portfolio_item_remove') {
      return {
        actionType,
        payload: { actionType, id },
        preview: { title: `Remove ${holdingLabel(current.kind)}`, before: current },
        sourceFingerprint: fingerprint(current),
      };
    }

    const { kind: _kind, ...changes } = parseHolding(args, current);
    return {
      actionType,
      payload: { actionType, id, changes },
      preview: { title: `Update ${holdingLabel(current.kind)}`, before: current, after: changes },
      sourceFingerprint: fingerprint(current),
    };
  }

  if (actionType === 'category_add') {
    const name = args.name as string;
    return {
      actionType,
      payload: { actionType, name, kind: args.kind as CategoryKind },
      preview: { title: `Add category "${name}"` },
    };
  }

  if (actionType === 'category_update' || actionType === 'category_remove') {
    const id = args.id as string;
    const current = (await listCategories()).find((category) => category.id === id);
    if (!current) {
      throw new ApiError('Category not found. Call categories_list for the current ids.', 404);
    }

    if (actionType === 'category_remove') {
      return {
        actionType,
        payload: { actionType, id: current.id, name: current.name },
        preview: { title: `Delete category "${current.name}"`, before: current },
      };
    }

    const changes = definedFields(args, ['name', 'kind', 'archived'] as const) as {
      name?: string;
      kind?: CategoryKind;
      archived?: boolean;
    };
    if (!Object.keys(changes).length) {
      throw new ApiError('Nothing to change: pass a new name, a kind, or archived');
    }
    return {
      actionType,
      payload: { actionType, id: current.id, changes },
      preview: { title: `Update category "${current.name}"`, before: current, after: changes },
    };
  }

  const month = args.month as string;
  const [ledger, categoryList] = await Promise.all([requireEditableLedger(month), listCategories()]);
  const sourceFingerprint =
    actionType === 'ledger_entry_add' ? ledgerStructureFingerprint(ledger) : ledgerFingerprint(ledger);
  const categoryIds = new Set(categoryList.map((category) => category.id));

  if (isAccountAction(actionType)) {
    const { payload, preview } = planAccountAction(actionType, args, ledger);
    assertLedger({ ...ledger, accounts: applyAccountAction(payload, ledger) }, categoryIds);
    return { actionType, payload, preview, sourceFingerprint };
  }

  if (actionType === 'ledger_entry_add') {
    const given = <T>(key: string) => (args[key] ?? undefined) as T | undefined;
    const type = isEntryType(args.type) ? args.type : 'expense';
    const entry = {
      id: randomUUID(),
      date: defaultEntryDate(month, given<string>('date')),
      type,
      accountId:
        ledger.accounts.find((account) => account.id === args.accountId)?.id ??
        resolveAccountId(ledger.accounts, args.accountName) ??
        firstAccountId(ledger.accounts, type),
      destinationAccountId: given<string>('destinationAccountId'),
      amount: given<number>('amount'),
      destinationAmount: given<number>('destinationAmount'),
      exchangeRate: given<number>('exchangeRate'),
      categoryId: resolveCategoryArg(categoryList, args.category) ?? undefined,
      counterparty: given<string>('counterparty'),
      note: given<string>('note'),
    };
    return {
      actionType,
      payload: { actionType, month, entry },
      preview: { title: 'Add ledger entry' },
      sourceFingerprint,
      form: ledgerForm('ledger_entry_add', month, ledger.accounts, categoryList, entry),
    };
  }

  const entryId = resolveEntryId(ledger, args);
  const current = ledger.entries.find((entry) => entry.id === entryId);
  if (!current) throw new ApiError('Ledger entry not found', 404);

  if (actionType === 'ledger_entry_remove') {
    assertLedger({ ...ledger, entries: ledger.entries.filter((entry) => entry.id !== entryId) }, categoryIds);
    return {
      actionType,
      payload: { actionType, month, entryId },
      preview: { title: 'Remove ledger entry', before: current },
      sourceFingerprint,
    };
  }

  const { exchangeRate: _rate, ...formEntry } = current;
  return {
    actionType,
    payload: { actionType: 'ledger_entry_update', month, entryId, entry: current },
    preview: { title: 'Update ledger entry', before: current },
    sourceFingerprint,
    form: ledgerForm('ledger_entry_update', month, ledger.accounts, categoryList, formEntry),
  };
}

export async function executeFinancePayload(
  payload: FinancePayload,
  sourceFingerprint: string | null,
  entryOverride?: unknown
) {
  switch (payload.actionType) {
    case 'portfolio_item_add':
    case 'portfolio_item_update':
    case 'portfolio_item_remove':
      return executePortfolioPayload(payload, sourceFingerprint);
    case 'ledger_entry_add':
    case 'ledger_entry_update':
    case 'ledger_entry_remove':
    case 'ledger_account_add':
    case 'ledger_account_update':
    case 'ledger_account_remove':
      return executeLedgerPayload(applyEntryOverride(payload, entryOverride) as LedgerPayload, sourceFingerprint);
    case 'category_add':
      return addCategory({ name: payload.name, kind: payload.kind });
    case 'category_update':
      return editCategory(payload.id, payload.changes);
    case 'category_remove':
      await discardCategory(payload.id);
      return { id: payload.id, name: payload.name, removed: true };
    default: {
      const unrouted: never = payload;
      throw new ApiError(`No executor for ${(unrouted as { actionType: string }).actionType}`, 500);
    }
  }
}

async function executePortfolioPayload(
  payload: Extract<FinancePayload, { actionType: `portfolio_item_${string}` }>,
  sourceFingerprint: string | null
) {
  if (payload.actionType === 'portfolio_item_add') return addHolding(parseHolding(payload.item));
  const current = await requireCurrentHolding(payload.id, sourceFingerprint);
  if (payload.actionType === 'portfolio_item_update') {
    const { kind: _kind, ...changes } = parseHolding(payload.changes, current);
    return updateHolding(payload.id, changes);
  }
  if (!(await removeHolding(payload.id))) throw new ApiError('Holding no longer exists', 409);
  return { id: payload.id, removed: true };
}

async function executeLedgerPayload(payload: LedgerPayload, sourceFingerprint: string | null) {
  const ledger = await requireEditableLedger(payload.month);
  if (payload.actionType === 'ledger_entry_add') {
    assertUnchanged(ledgerStructureFingerprint(ledger), sourceFingerprint, 'ledger accounts');
  } else {
    assertUnchanged(ledgerFingerprint(ledger), sourceFingerprint, 'ledger');
  }

  const categoryList = await listCategories();
  const withCategory = (entry: object) => {
    const fields = entry as Record<string, unknown>;
    if (!('category' in fields)) return fields;
    const { category, ...rest } = fields;
    return { ...rest, categoryId: resolveCategoryArg(categoryList, category) };
  };

  if (payload.actionType === 'ledger_entry_add' || payload.actionType === 'ledger_entry_update') {
    const entry = parseLedgerEntry(withCategory(payload.entry), { id: payload.entry.id });
    const kind = payload.actionType === 'ledger_entry_add' ? 'add' : 'update';
    return ledgerWriteResult(payload, await changeLedgerEntry(payload.month, { kind, entry }));
  }
  if (payload.actionType === 'ledger_entry_remove') {
    return ledgerWriteResult(payload, await changeLedgerEntry(payload.month, { kind: 'remove', id: payload.entryId }));
  }

  const accounts = applyAccountAction(payload, ledger);
  assertLedger({ ...ledger, accounts }, new Set(categoryList.map((category) => category.id)));
  const saved = await saveLedgerSynced(ledger, { ...ledger, accounts });
  if (!saved) throw new ApiError('The ledger changed while saving. Ask the assistant to try again.', 409);
  return ledgerWriteResult(payload, saved);
}

function ledgerWriteResult(payload: LedgerPayload, saved: MonthlyLedger) {
  const { month } = saved;
  switch (payload.actionType) {
    case 'ledger_entry_remove':
      return { month, entryId: payload.entryId, removed: true };
    case 'ledger_account_remove':
      return { month, accountId: payload.accountId, removed: true };
    case 'ledger_entry_add':
    case 'ledger_entry_update': {
      const index = saved.entries.findIndex((entry) => entry.id === payload.entry.id);
      return { month, entry: { ...saved.entries[index], serial: serialFor(index) } };
    }
    default: {
      const id = payload.actionType === 'ledger_account_add' ? payload.account.id : payload.accountId;
      return { month, account: saved.accounts.find((account) => account.id === id) };
    }
  }
}

function resolveCategoryArg(categoryList: LedgerCategory[], value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const name = requireString(value, 'category');
  const id = resolveCategoryId(categoryList, name);
  if (id) return id;

  const near = categoryList
    .filter((category) => !category.archivedAt)
    .map((category) => category.name)
    .filter((candidate) => candidate.toLowerCase().includes(name.toLowerCase()));
  throw new ApiError(
    near.length
      ? `"${name}" matches more than one category: ${near.join(', ')}. Use the exact name.`
      : `No category is called "${name}". Call categories_list for the valid names.`,
    404
  );
}

async function requireCurrentHolding(id: string, sourceFingerprint: string | null) {
  const current = await getHolding(id);
  if (!current) throw new ApiError('Holding no longer exists', 409);
  assertUnchanged(fingerprint(current), sourceFingerprint, 'holding');
  return current;
}

async function requireEditableLedger(month: string) {
  const ledger = await requireLedger(month);
  if (ledger.status === 'finalized') {
    throw new ApiError('Finalized ledgers cannot be edited', 409);
  }
  return ledger;
}

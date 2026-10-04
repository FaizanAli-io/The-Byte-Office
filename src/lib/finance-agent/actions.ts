import { randomUUID } from 'crypto';
import { AgentActionError } from '@/lib/agent/action-utils';
import { listCategories, loadLedger } from '@/lib/db/queries';
import { addCategory, discardCategory, editCategory } from '@/lib/categories';
import { resolveCategoryId } from '@/lib/ledger';
import { CATEGORY_KINDS, type CategoryKind, type LedgerCategory, type MonthlyLedger } from '@/types/ledger';
import { fingerprint } from '@/lib/agent/repository';
import type {
  AgentActionPayload,
  AgentActionType,
  AgentProposal,
  PersonalActionType,
  PortfolioItemType,
} from '@/lib/agent/types';
import { applyAccountAction, isAccountAction, planAccountAction } from './ledger-accounts';
import { changeLedgerEntry } from '@/lib/ledger-entries';
import {
  addPortfolioItem,
  getPortfolioItem,
  removePortfolioItem,
  saveLedgerSynced,
  updatePortfolioItem,
} from '@/lib/db/portfolio';
import {
  applyEntryOverride,
  assertLedgerStructure,
  assertLedger,
  defaultEntryDate,
  firstAccountId,
  isEntryType,
  ledgerFingerprint,
  ledgerForm,
  ledgerStructureFingerprint,
  optionalAccountId,
  optionalPositive,
  optionalString,
  parseItemType,
  parseLedgerEntry,
  parsePortfolioItem,
  parsePortfolioUpdate,
  portfolioLabel,
  requireRecord,
  requireString,
  resolveAccountId,
  resolveEntryId,
} from './action-parsing';

type FinancePayload = Exclude<AgentActionPayload, { actionType: PersonalActionType | 'tbo_send_inquiry' }>;
type LedgerPayload = Extract<FinancePayload, { actionType: `ledger_${string}` }>;

export async function proposeFinanceAction(actionType: AgentActionType, rawArgs: unknown): Promise<AgentProposal> {
  const args = requireRecord(rawArgs);

  if (actionType === 'portfolio_item_add') {
    const item = parsePortfolioItem(args);
    return {
      actionType,
      payload: { actionType, item },
      preview: {
        title: `Add ${portfolioLabel(item.itemType)}`,
        after: item,
      },
    };
  }

  if (actionType === 'portfolio_item_update' || actionType === 'portfolio_item_remove') {
    const itemType = parseItemType(args.itemType);
    const id = requireString(args.id, 'id');
    const current = await getPortfolioItem(itemType, id);
    if (!current) throw new AgentActionError('Portfolio item not found', 404);

    if (actionType === 'portfolio_item_remove') {
      return {
        actionType,
        payload: { actionType, itemType, id },
        preview: {
          title: `Remove ${portfolioLabel(itemType)}`,
          before: current,
        },
        sourceFingerprint: fingerprint(current),
      };
    }

    const changes = parsePortfolioUpdate(itemType, args, current);
    return {
      actionType,
      payload: { actionType, itemType, id, changes },
      preview: {
        title: `Update ${portfolioLabel(itemType)}`,
        before: current,
        after: changes,
      },
      sourceFingerprint: fingerprint(current),
    };
  }

  if (actionType === 'category_add') {
    const name = requireString(args.name, 'name');
    return {
      actionType,
      payload: { actionType, name, kind: parseCategoryKind(args.kind) },
      preview: { title: `Add category "${name}"` },
    };
  }

  if (actionType === 'category_update' || actionType === 'category_remove') {
    const id = requireString(args.id, 'id');
    const current = (await listCategories()).find((category) => category.id === id);
    if (!current) {
      throw new AgentActionError('Category not found. Call categories_list for the current ids.', 404);
    }

    if (actionType === 'category_remove') {
      return {
        actionType,
        payload: { actionType, id: current.id, name: current.name },
        preview: { title: `Delete category "${current.name}"`, before: current },
      };
    }

    const changes = {
      ...(args.name === undefined ? {} : { name: requireString(args.name, 'name') }),
      ...(args.kind === undefined ? {} : { kind: parseCategoryKind(args.kind) }),
      ...(typeof args.archived === 'boolean' ? { archived: args.archived } : {}),
    };
    if (!Object.keys(changes).length) {
      throw new AgentActionError('Nothing to change: pass a new name, a kind, or archived');
    }
    return {
      actionType,
      payload: { actionType, id: current.id, changes },
      preview: { title: `Update category "${current.name}"`, before: current, after: changes },
    };
  }

  const month = requireString(args.month, 'month');
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
    const date = defaultEntryDate(month, typeof args.date === 'string' ? args.date : undefined);
    const type = isEntryType(args.type) ? args.type : 'expense';
    const accountIdFromName = resolveAccountId(ledger.accounts, args.accountName);
    const accountId =
      typeof args.accountId === 'string' && ledger.accounts.some((account) => account.id === args.accountId)
        ? args.accountId
        : accountIdFromName
          ? accountIdFromName
          : firstAccountId(ledger.accounts, type);
    const entry = {
      id: randomUUID(),
      date,
      type,
      accountId,
      destinationAccountId: optionalAccountId(args.destinationAccountId),
      amount: optionalPositive(args.amount),
      destinationAmount: optionalPositive(args.destinationAmount),
      exchangeRate: optionalPositive(args.exchangeRate),
      categoryId: resolveCategoryArg(categoryList, args.category) ?? undefined,
      note: optionalString(args.note),
    };
    return {
      actionType,
      payload: { actionType, month, entry },
      preview: { title: 'Add ledger entry' },
      sourceFingerprint,
      form: ledgerForm('ledger_entry_add', month, ledger.accounts, categoryList, {
        ...entry,
      }),
    };
  }

  const entryId = resolveEntryId(ledger, args);
  const current = ledger.entries.find((entry) => entry.id === entryId);
  if (!current) throw new AgentActionError('Ledger entry not found', 404);

  if (actionType === 'ledger_entry_remove') {
    assertLedger({ ...ledger, entries: ledger.entries.filter((entry) => entry.id !== entryId) }, categoryIds);
    return {
      actionType,
      payload: { actionType, month, entryId },
      preview: { title: 'Remove ledger entry', before: current },
      sourceFingerprint,
    };
  }

  return {
    actionType,
    payload: { actionType: 'ledger_entry_update', month, entryId, entry: current },
    preview: {
      title: 'Update ledger entry',
      before: current,
    },
    sourceFingerprint,
    form: ledgerForm('ledger_entry_update', month, ledger.accounts, categoryList, {
      id: current.id,
      date: current.date,
      type: current.type,
      accountId: current.accountId,
      destinationAccountId: current.destinationAccountId,
      amount: current.amount,
      destinationAmount: current.destinationAmount,
      categoryId: current.categoryId,
      counterparty: current.counterparty,
      note: current.note,
    }),
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
      throw new AgentActionError(`No executor for ${(unrouted as { actionType: string }).actionType}`, 500);
    }
  }
}

async function executePortfolioPayload(
  payload: Extract<FinancePayload, { actionType: `portfolio_item_${string}` }>,
  sourceFingerprint: string | null
) {
  if (payload.actionType === 'portfolio_item_add') {
    parsePortfolioItem(payload.item as unknown as Record<string, unknown>);
    return addPortfolioItem(payload.item);
  }
  const current = await requireCurrentPortfolioItem(payload.itemType, payload.id, sourceFingerprint);
  if (payload.actionType === 'portfolio_item_update') {
    return updatePortfolioItem(
      payload.itemType,
      payload.id,
      parsePortfolioUpdate(payload.itemType, payload.changes, current)
    );
  }
  const removed = await removePortfolioItem(payload.itemType, payload.id);
  if (!removed.length) throw new AgentActionError('Item no longer exists', 409);
  return { id: payload.id, removed: true };
}

async function executeLedgerPayload(payload: LedgerPayload, sourceFingerprint: string | null) {
  const ledger = await requireEditableLedger(payload.month);
  if (payload.actionType === 'ledger_entry_add') {
    assertLedgerStructure(ledger, sourceFingerprint);
  } else if (ledgerFingerprint(ledger) !== sourceFingerprint) {
    throw new AgentActionError('The ledger changed after this proposal. Ask the assistant to try again.', 409);
  }

  const categoryList = await listCategories();
  const withCategory = (entry: object) => {
    const fields = entry as Record<string, unknown>;
    if (!('category' in fields)) return fields;
    const { category, ...rest } = fields;
    return { ...rest, categoryId: resolveCategoryArg(categoryList, category) };
  };

  if (payload.actionType === 'ledger_entry_add') {
    const entry = parseLedgerEntry(withCategory(payload.entry), { id: payload.entry.id });
    return ledgerWriteResult(payload, await changeLedgerEntry(payload.month, { kind: 'add', entry }));
  }
  if (payload.actionType === 'ledger_entry_update') {
    const entry = parseLedgerEntry(withCategory(payload.entry), { id: payload.entryId });
    return ledgerWriteResult(payload, await changeLedgerEntry(payload.month, { kind: 'update', entry }));
  }
  if (payload.actionType === 'ledger_entry_remove') {
    return ledgerWriteResult(payload, await changeLedgerEntry(payload.month, { kind: 'remove', id: payload.entryId }));
  }

  const accounts = applyAccountAction(payload, ledger);
  assertLedger({ ...ledger, accounts }, new Set(categoryList.map((category) => category.id)));
  const saved = await saveLedgerSynced(ledger, { ...ledger, accounts });
  if (!saved) throw new AgentActionError('The ledger changed while saving. Ask the assistant to try again.', 409);
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
      const id = payload.actionType === 'ledger_entry_add' ? payload.entry.id : payload.entryId;
      const index = saved.entries.findIndex((entry) => entry.id === id);
      return { month, entry: { ...saved.entries[index], serial: String(index + 1).padStart(4, '0') } };
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
  throw new AgentActionError(
    near.length
      ? `"${name}" matches more than one category: ${near.join(', ')}. Use the exact name.`
      : `No category is called "${name}". Call categories_list for the valid names.`,
    404
  );
}

function parseCategoryKind(value: unknown): CategoryKind {
  if (value === undefined) return 'both';
  if (typeof value !== 'string' || !(CATEGORY_KINDS as readonly string[]).includes(value)) {
    throw new AgentActionError(`kind must be one of: ${CATEGORY_KINDS.join(', ')}`);
  }
  return value as CategoryKind;
}

async function requireCurrentPortfolioItem(itemType: PortfolioItemType, id: string, sourceFingerprint: string | null) {
  const current = await getPortfolioItem(itemType, id);
  if (!current) throw new AgentActionError('Portfolio item no longer exists', 409);
  if (fingerprint(current) !== sourceFingerprint) {
    throw new AgentActionError('The portfolio item changed after this proposal. Ask the assistant to try again.', 409);
  }
  return current;
}

async function requireEditableLedger(month: string) {
  const ledger = await loadLedger(month);
  if (!ledger) throw new AgentActionError('Ledger not found', 404);
  if (ledger.status === 'finalized') {
    throw new AgentActionError('Finalized ledgers cannot be edited', 409);
  }
  return ledger;
}

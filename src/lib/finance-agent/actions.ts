import { randomUUID } from 'crypto';
import { AgentActionError, toPublicAction } from '@/lib/agent/action-utils';
import { executePersonalPayload } from '@/lib/agent/modules/personal';
import { executeTboInquiry } from '@/lib/agent/modules/tbo-actions';
import { listCategories, loadLedger, saveLedger } from '@/lib/db/queries';
import { addCategory, discardCategory, editCategory } from '@/lib/categories';
import { resolveCategoryId } from '@/lib/ledger';
import { CATEGORY_KINDS, type CategoryKind, type LedgerCategory, type LedgerEntry } from '@/types/ledger';
import {
  addPortfolioItem,
  cancelAgentAction,
  claimAgentAction,
  completeAgentAction,
  createAgentAction,
  failAgentAction,
  fingerprint,
  getAgentAction,
  getPortfolioItem,
  removePortfolioItem,
  syncActionInMessages,
  updatePortfolioItem,
} from './repository';
import {
  applyEntryOverride,
  assertLedgerStructure,
  assertLedgerWithEntries,
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
import type { AgentActionPayload, AgentActionType, PortfolioItemType } from './types';

export { AgentActionError, toPublicAction } from '@/lib/agent/action-utils';

export async function proposeAgentAction(actionType: AgentActionType, rawArgs: unknown) {
  const args = requireRecord(rawArgs);

  if (actionType === 'portfolio_item_add') {
    const item = parsePortfolioItem(args);
    return toPublicAction(
      await createAgentAction({
        actionType,
        payload: { actionType, item },
        preview: {
          title: `Add ${portfolioLabel(item.itemType)}`,
          after: item,
        },
      })
    );
  }

  if (actionType === 'portfolio_item_update' || actionType === 'portfolio_item_remove') {
    const itemType = parseItemType(args.itemType);
    const id = requireString(args.id, 'id');
    const current = await getPortfolioItem(itemType, id);
    if (!current) throw new AgentActionError('Portfolio item not found', 404);

    if (actionType === 'portfolio_item_remove') {
      return toPublicAction(
        await createAgentAction({
          actionType,
          payload: { actionType, itemType, id },
          preview: {
            title: `Remove ${portfolioLabel(itemType)}`,
            before: current,
          },
          sourceFingerprint: fingerprint(current),
        })
      );
    }

    const changes = parsePortfolioUpdate(itemType, args, current);
    return toPublicAction(
      await createAgentAction({
        actionType,
        payload: { actionType, itemType, id, changes },
        preview: {
          title: `Update ${portfolioLabel(itemType)}`,
          before: current,
          after: changes,
        },
        sourceFingerprint: fingerprint(current),
      })
    );
  }

  if (actionType === 'category_add') {
    const name = requireString(args.name, 'name');
    return toPublicAction(
      await createAgentAction({
        actionType,
        payload: { actionType, name, kind: parseCategoryKind(args.kind) },
        preview: { title: `Add category "${name}"` },
      })
    );
  }

  if (actionType === 'category_update' || actionType === 'category_remove') {
    // Identified by id, not by name: a rename would otherwise have to match
    // the name it is about to replace, and archived categories — the ones you
    // restore — are deliberately unreachable by name.
    const id = requireString(args.id, 'id');
    const current = (await listCategories()).find((category) => category.id === id);
    if (!current) {
      throw new AgentActionError('Category not found. Call categories_list for the current ids.', 404);
    }

    if (actionType === 'category_remove') {
      return toPublicAction(
        await createAgentAction({
          actionType,
          payload: { actionType, id: current.id, name: current.name },
          preview: { title: `Delete category "${current.name}"`, before: current },
        })
      );
    }

    const changes = {
      ...(args.name === undefined ? {} : { name: requireString(args.name, 'name') }),
      ...(args.kind === undefined ? {} : { kind: parseCategoryKind(args.kind) }),
      ...(typeof args.archived === 'boolean' ? { archived: args.archived } : {}),
    };
    if (!Object.keys(changes).length) {
      throw new AgentActionError('Nothing to change: pass a new name, a kind, or archived');
    }
    return toPublicAction(
      await createAgentAction({
        actionType,
        payload: { actionType, id: current.id, changes },
        preview: { title: `Update category "${current.name}"`, before: current, after: changes },
      })
    );
  }

  const month = requireString(args.month, 'month');
  const [ledger, categoryList] = await Promise.all([requireEditableLedger(month), listCategories()]);
  const sourceFingerprint =
    actionType === 'ledger_entry_add' ? ledgerStructureFingerprint(ledger) : ledgerFingerprint(ledger);

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
    return toPublicAction(
      await createAgentAction({
        actionType,
        payload: { actionType, month, entry },
        preview: { title: 'Add ledger entry' },
        sourceFingerprint,
      }),
      ledgerForm('ledger_entry_add', month, ledger.accounts, categoryList, {
        ...entry,
      })
    );
  }

  const entryId = resolveEntryId(ledger, args);
  const current = ledger.entries.find((entry) => entry.id === entryId);
  if (!current) throw new AgentActionError('Ledger entry not found', 404);

  if (actionType === 'ledger_entry_remove') {
    assertLedgerWithEntries(
      ledger,
      ledger.entries.filter((entry) => entry.id !== entryId),
      new Set(categoryList.map((category) => category.id))
    );
    return toPublicAction(
      await createAgentAction({
        actionType,
        payload: { actionType, month, entryId },
        preview: { title: 'Remove ledger entry', before: current },
        sourceFingerprint,
      })
    );
  }

  return toPublicAction(
    await createAgentAction({
      actionType,
      payload: { actionType: 'ledger_entry_update', month, entryId, entry: current },
      preview: {
        title: 'Update ledger entry',
        before: current,
      },
      sourceFingerprint,
    }),
    ledgerForm('ledger_entry_update', month, ledger.accounts, categoryList, {
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
    })
  );
}

export async function executeAgentAction(id: string, entryOverride?: unknown) {
  const action = await claimAgentAction(id);
  if (!action) {
    const existing = await getAgentAction(id);
    if (!existing) throw new AgentActionError('Action not found', 404);
    if (existing.status === 'pending' && existing.expiresAt <= new Date()) {
      await failAgentAction(id, 'Action expired before confirmation');
      throw new AgentActionError('This confirmation has expired', 409);
    }
    throw new AgentActionError(`This action is already ${existing.status}`, 409);
  }

  try {
    const result = await executePayload(
      applyEntryOverride(action.payload as unknown as AgentActionPayload, entryOverride),
      action.sourceFingerprint
    );
    const completed = await completeAgentAction(action.id);
    if (!completed) {
      throw new Error('Could not mark the action as completed');
    }
    const publicAction = toPublicAction(completed);
    await syncActionInMessages(action.id, publicAction);
    return { action: publicAction, result };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Action execution failed';
    await failAgentAction(action.id, message);
    await syncActionInMessages(id, { status: 'failed', error: message });
    throw cause instanceof AgentActionError ? cause : new AgentActionError(message, 409);
  }
}

export async function cancelPendingAgentAction(id: string) {
  const cancelled = await cancelAgentAction(id);
  if (cancelled) {
    const publicAction = toPublicAction(cancelled);
    await syncActionInMessages(id, publicAction);
    return publicAction;
  }

  const existing = await getAgentAction(id);
  if (!existing) throw new AgentActionError('Action not found', 404);
  throw new AgentActionError(`This action is already ${existing.status}`, 409);
}

async function executePayload(payload: AgentActionPayload, sourceFingerprint: string | null) {
  switch (payload.actionType) {
    case 'portfolio_item_add':
      parsePortfolioItem(payload.item as unknown as Record<string, unknown>);
      return addPortfolioItem(payload.item);
    case 'portfolio_item_update': {
      const current = await requireCurrentPortfolioItem(payload.itemType, payload.id, sourceFingerprint);
      const changes = parsePortfolioUpdate(payload.itemType, payload.changes, current);
      return updatePortfolioItem(payload.itemType, payload.id, changes);
    }
    case 'portfolio_item_remove': {
      await requireCurrentPortfolioItem(payload.itemType, payload.id, sourceFingerprint);
      const removed = await removePortfolioItem(payload.itemType, payload.id);
      if (!removed.length) throw new AgentActionError('Item no longer exists', 409);
      return { id: payload.id, removed: true };
    }
    case 'ledger_entry_add':
    case 'ledger_entry_update':
    case 'ledger_entry_remove':
      return executeLedgerPayload(payload, sourceFingerprint);
    case 'category_add':
      return addCategory({ name: payload.name, kind: payload.kind });
    case 'category_update':
      return editCategory(payload.id, payload.changes);
    case 'category_remove':
      await discardCategory(payload.id);
      return { id: payload.id, name: payload.name, removed: true };
    case 'prayer_set':
    case 'prayer_remove':
    case 'health_add':
    case 'health_update':
    case 'health_remove':
      return executePersonalPayload(payload, sourceFingerprint);
    case 'tbo_send_inquiry':
      return executeTboInquiry(payload);
  }
}

async function executeLedgerPayload(
  payload: Extract<
    AgentActionPayload,
    {
      actionType: 'ledger_entry_add' | 'ledger_entry_update' | 'ledger_entry_remove';
    }
  >,
  sourceFingerprint: string | null
) {
  const ledger = await requireEditableLedger(payload.month);
  if (payload.actionType === 'ledger_entry_add') {
    assertLedgerStructure(ledger, sourceFingerprint);
  } else if (ledgerFingerprint(ledger) !== sourceFingerprint) {
    throw new AgentActionError('The ledger changed after this proposal. Ask the assistant to try again.', 409);
  }

  // The tool arguments are replayed over the payload on the MCP surface, and
  // they name a category rather than identifying one. Translating here covers
  // add and update alike; without it an update quietly kept its old category.
  const categoryList = await listCategories();
  const withCategory = (entry: object) => {
    const fields = entry as Record<string, unknown>;
    if (!('category' in fields)) return fields;
    const { category, ...rest } = fields;
    return { ...rest, categoryId: resolveCategoryArg(categoryList, category) };
  };

  let entries: LedgerEntry[];
  if (payload.actionType === 'ledger_entry_add') {
    const entry = parseLedgerEntry(withCategory(payload.entry), { id: payload.entry.id });
    if (ledger.entries.some((item) => item.id === entry.id)) {
      throw new AgentActionError('This entry was already added. Ask the assistant to open a new form.', 409);
    }
    entries = [...ledger.entries, entry];
  } else if (payload.actionType === 'ledger_entry_update') {
    if (!ledger.entries.some((entry) => entry.id === payload.entryId)) {
      throw new AgentActionError('Ledger entry no longer exists', 409);
    }
    const entry = parseLedgerEntry(withCategory(payload.entry), { id: payload.entryId });
    entries = ledger.entries.map((item) => (item.id === payload.entryId ? entry : item));
  } else {
    if (!ledger.entries.some((entry) => entry.id === payload.entryId)) {
      throw new AgentActionError('Ledger entry no longer exists', 409);
    }
    entries = ledger.entries.filter((entry) => entry.id !== payload.entryId);
  }

  assertLedgerWithEntries(ledger, entries, new Set(categoryList.map((category) => category.id)));
  return saveLedger(ledger, {
    month: ledger.month,
    status: ledger.status,
    accounts: ledger.accounts,
    entries,
    finalizedAt: ledger.finalizedAt,
  });
}

/**
 * Turns the assistant's category **name** into an id.
 *
 * Absent means "leave it alone", `null` means "clear it", and a name that
 * matches nothing is an error rather than a silent drop — writing an
 * uncategorised entry and saying nothing is the worst of the three outcomes,
 * because on MCP there is no form for anyone to notice it in.
 */
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

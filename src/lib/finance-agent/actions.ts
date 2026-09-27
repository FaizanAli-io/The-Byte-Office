import { randomUUID } from 'crypto';
import { AgentActionError, toPublicAction } from '@/lib/agent/action-utils';
import { executePersonalPayload } from '@/lib/agent/modules/personal';
import { executeTboInquiry } from '@/lib/agent/modules/tbo-actions';
import { listCategories, loadLedger, saveLedger } from '@/lib/db/queries';
import { resolveCategoryId } from '@/lib/ledger';
import type { LedgerEntry } from '@/types/ledger';
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
      // The assistant names a category; only an unambiguous, unarchived match
      // resolves, and anything else simply leaves the entry uncategorised for
      // the user to fix in the form.
      categoryId: resolveCategoryId(categoryList, args.category ?? args.categoryId),
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

  let entries: LedgerEntry[];
  if (payload.actionType === 'ledger_entry_add') {
    const entry = parseLedgerEntry(payload.entry as unknown as Record<string, unknown>, { id: payload.entry.id });
    if (ledger.entries.some((item) => item.id === entry.id)) {
      throw new AgentActionError('This entry was already added. Ask the assistant to open a new form.', 409);
    }
    entries = [...ledger.entries, entry];
  } else if (payload.actionType === 'ledger_entry_update') {
    if (!ledger.entries.some((entry) => entry.id === payload.entryId)) {
      throw new AgentActionError('Ledger entry no longer exists', 409);
    }
    const entry = parseLedgerEntry(payload.entry as unknown as Record<string, unknown>, { id: payload.entryId });
    entries = ledger.entries.map((item) => (item.id === payload.entryId ? entry : item));
  } else {
    if (!ledger.entries.some((entry) => entry.id === payload.entryId)) {
      throw new AgentActionError('Ledger entry no longer exists', 409);
    }
    entries = ledger.entries.filter((entry) => entry.id !== payload.entryId);
  }

  assertLedgerWithEntries(ledger, entries, new Set((await listCategories()).map((category) => category.id)));
  return saveLedger(ledger, {
    month: ledger.month,
    status: ledger.status,
    accounts: ledger.accounts,
    entries,
    finalizedAt: ledger.finalizedAt,
  });
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

import { createHash } from 'crypto';
import { and, asc, desc, eq, gt, inArray, max } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  agentConversations,
  financeAgentActions,
  financeAgentMessages,
  financeAgentToolLogs,
  financeSnapshots,
  localBanks,
  mutualFunds,
  remoteBanks,
} from '@/lib/db/schema';
import {
  parseAgentWorkspace,
  type ActionPreview,
  type AgentActionPayload,
  type AgentActionType,
  type AgentConversation,
  type AgentWorkspace,
  type FinanceChatMessage,
  type PendingAgentAction,
  type PortfolioItemInput,
  type PortfolioItemType,
} from './types';

const ACTION_TTL_MS = 15 * 60 * 1000;

export async function loadAgentPortfolio() {
  const db = getDb();
  const [local, remote, funds] = await Promise.all([
    db.select().from(localBanks).orderBy(asc(localBanks.sortOrder)),
    db.select().from(remoteBanks).orderBy(asc(remoteBanks.sortOrder)),
    db.select().from(mutualFunds).orderBy(asc(mutualFunds.sortOrder)),
  ]);
  return {
    localBanks: local,
    remoteBanks: remote,
    mutualFunds: funds,
  };
}

export async function getPortfolioItem(itemType: PortfolioItemType, id: string) {
  const db = getDb();
  if (itemType === 'local_bank') {
    return (await db.select().from(localBanks).where(eq(localBanks.id, id)).limit(1))[0] ?? null;
  }
  if (itemType === 'remote_bank') {
    return (await db.select().from(remoteBanks).where(eq(remoteBanks.id, id)).limit(1))[0] ?? null;
  }
  return (await db.select().from(mutualFunds).where(eq(mutualFunds.id, id)).limit(1))[0] ?? null;
}

export async function addPortfolioItem(item: PortfolioItemInput) {
  const db = getDb();
  if (item.itemType === 'local_bank') {
    const [order] = await db.select({ value: max(localBanks.sortOrder) }).from(localBanks);
    const [created] = await db
      .insert(localBanks)
      .values({
        name: item.name,
        amountPkr: item.amountPkr,
        sortOrder: (order.value ?? -1) + 1,
      })
      .returning();
    return created;
  }
  if (item.itemType === 'remote_bank') {
    const [order] = await db.select({ value: max(remoteBanks.sortOrder) }).from(remoteBanks);
    const [created] = await db
      .insert(remoteBanks)
      .values({
        name: item.name,
        amountUsd: item.amountUsd,
        exchangeRate: item.exchangeRate,
        sortOrder: (order.value ?? -1) + 1,
      })
      .returning();
    return created;
  }

  const [order] = await db.select({ value: max(mutualFunds.sortOrder) }).from(mutualFunds);
  const [created] = await db
    .insert(mutualFunds)
    .values({
      bankName: item.bankName,
      fundName: item.fundName,
      value: item.value,
      sortOrder: (order.value ?? -1) + 1,
    })
    .returning();
  return created;
}

export async function updatePortfolioItem(itemType: PortfolioItemType, id: string, changes: Record<string, unknown>) {
  const db = getDb();
  const updatedAt = new Date();
  if (itemType === 'local_bank') {
    return (
      (
        await db
          .update(localBanks)
          .set({
            name: changes.name as string,
            amountPkr: changes.amountPkr as number,
            updatedAt,
          })
          .where(eq(localBanks.id, id))
          .returning()
      )[0] ?? null
    );
  }
  if (itemType === 'remote_bank') {
    return (
      (
        await db
          .update(remoteBanks)
          .set({
            name: changes.name as string,
            amountUsd: changes.amountUsd as number,
            exchangeRate: changes.exchangeRate as number,
            updatedAt,
          })
          .where(eq(remoteBanks.id, id))
          .returning()
      )[0] ?? null
    );
  }
  return (
    (
      await db
        .update(mutualFunds)
        .set({
          bankName: changes.bankName as string,
          fundName: changes.fundName as string,
          value: changes.value as number,
          updatedAt,
        })
        .where(eq(mutualFunds.id, id))
        .returning()
    )[0] ?? null
  );
}

export async function removePortfolioItem(itemType: PortfolioItemType, id: string) {
  const db = getDb();
  if (itemType === 'local_bank') {
    return db.delete(localBanks).where(eq(localBanks.id, id)).returning({ id: localBanks.id });
  }
  if (itemType === 'remote_bank') {
    return db.delete(remoteBanks).where(eq(remoteBanks.id, id)).returning({ id: remoteBanks.id });
  }
  return db.delete(mutualFunds).where(eq(mutualFunds.id, id)).returning({ id: mutualFunds.id });
}

export async function listAgentSnapshots() {
  return getDb()
    .select({
      id: financeSnapshots.id,
      timestamp: financeSnapshots.timestamp,
      grandTotal: financeSnapshots.grandTotal,
    })
    .from(financeSnapshots)
    .orderBy(desc(financeSnapshots.timestamp))
    .limit(50);
}

export async function logAgentToolCall(input: {
  requestId: string;
  model: string;
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  result?: unknown;
  error?: string;
  durationMs: number;
}) {
  await getDb()
    .insert(financeAgentToolLogs)
    .values({
      requestId: input.requestId,
      model: input.model,
      toolCallId: input.toolCallId,
      toolName: input.toolName,
      arguments: input.arguments,
      result: input.result,
      error: input.error?.slice(0, 1000),
      durationMs: input.durationMs,
    });
}

export async function listAgentToolLogs(limit = 200) {
  return getDb()
    .select()
    .from(financeAgentToolLogs)
    .orderBy(desc(financeAgentToolLogs.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));
}

export async function getAgentSnapshot(id: string) {
  return (await getDb().select().from(financeSnapshots).where(eq(financeSnapshots.id, id)).limit(1))[0] ?? null;
}

export async function createAgentAction(input: {
  actionType: AgentActionType;
  payload: AgentActionPayload;
  preview: ActionPreview;
  sourceFingerprint?: string | null;
}) {
  const [action] = await getDb()
    .insert(financeAgentActions)
    .values({
      actionType: input.actionType,
      payload: input.payload as unknown as Record<string, unknown>,
      preview: input.preview,
      sourceFingerprint: input.sourceFingerprint,
      expiresAt: new Date(Date.now() + ACTION_TTL_MS),
    })
    .returning();
  return action;
}

export async function getAgentAction(id: string) {
  return (await getDb().select().from(financeAgentActions).where(eq(financeAgentActions.id, id)).limit(1))[0] ?? null;
}

export async function claimAgentAction(id: string) {
  return (
    (
      await getDb()
        .update(financeAgentActions)
        .set({ status: 'executing', error: null })
        .where(
          and(
            eq(financeAgentActions.id, id),
            eq(financeAgentActions.status, 'pending'),
            gt(financeAgentActions.expiresAt, new Date())
          )
        )
        .returning()
    )[0] ?? null
  );
}

export async function cancelAgentAction(id: string) {
  return (
    (
      await getDb()
        .update(financeAgentActions)
        .set({ status: 'cancelled' })
        .where(and(eq(financeAgentActions.id, id), eq(financeAgentActions.status, 'pending')))
        .returning()
    )[0] ?? null
  );
}

export async function completeAgentAction(id: string) {
  const [action] = await getDb()
    .update(financeAgentActions)
    .set({ status: 'completed', executedAt: new Date(), error: null })
    .where(and(eq(financeAgentActions.id, id), eq(financeAgentActions.status, 'executing')))
    .returning();
  return action ?? null;
}

export async function failAgentAction(id: string, error: string) {
  const [action] = await getDb()
    .update(financeAgentActions)
    .set({ status: 'failed', error: error.slice(0, 500) })
    .where(eq(financeAgentActions.id, id))
    .returning();
  return action ?? null;
}

export async function listConversations(workspace?: AgentWorkspace): Promise<AgentConversation[]> {
  const db = getDb();
  const rows = workspace
    ? await db
        .select()
        .from(agentConversations)
        .where(eq(agentConversations.workspace, workspace))
        .orderBy(desc(agentConversations.updatedAt))
    : await db.select().from(agentConversations).orderBy(desc(agentConversations.updatedAt));
  return rows.map(toConversation);
}

export async function getConversation(id: string): Promise<AgentConversation | null> {
  const [row] = await getDb().select().from(agentConversations).where(eq(agentConversations.id, id)).limit(1);
  return row ? toConversation(row) : null;
}

export async function createConversation(
  title = 'New chat',
  workspace: AgentWorkspace = 'finance'
): Promise<AgentConversation> {
  const [row] = await getDb().insert(agentConversations).values({ title, workspace }).returning();
  return toConversation(row);
}

export async function renameConversation(id: string, title: string) {
  const [row] = await getDb()
    .update(agentConversations)
    .set({ title, updatedAt: new Date() })
    .where(eq(agentConversations.id, id))
    .returning();
  return row ? toConversation(row) : null;
}

export async function deleteConversation(id: string) {
  const deleted = await getDb()
    .delete(agentConversations)
    .where(eq(agentConversations.id, id))
    .returning({ id: agentConversations.id });
  return deleted.length > 0;
}

export async function touchConversation(id: string, title?: string) {
  await getDb()
    .update(agentConversations)
    .set({
      updatedAt: new Date(),
      ...(title ? { title } : {}),
    })
    .where(eq(agentConversations.id, id));
}

function toConversation(row: typeof agentConversations.$inferSelect): AgentConversation {
  return {
    id: row.id,
    title: row.title,
    workspace: parseAgentWorkspace(row.workspace),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAgentMessages(chatId: string, limit = 80) {
  const rows = await getDb()
    .select()
    .from(financeAgentMessages)
    .where(eq(financeAgentMessages.chatId, chatId))
    .orderBy(asc(financeAgentMessages.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  const storedActions = rows.flatMap((row) => (Array.isArray(row.actions) ? row.actions : []));
  const actionIds = [
    ...new Set(
      storedActions.flatMap((action) => {
        if (typeof action === 'object' && action !== null && 'id' in action && typeof action.id === 'string') {
          return [action.id];
        }
        return [];
      })
    ),
  ];
  const liveActions =
    actionIds.length > 0
      ? await getDb().select().from(financeAgentActions).where(inArray(financeAgentActions.id, actionIds))
      : [];
  const liveById = new Map(liveActions.map((action) => [action.id, action]));

  return rows.map((row): FinanceChatMessage => {
    const actions = Array.isArray(row.actions)
      ? row.actions.map((item) => hydrateStoredAction(item, liveById))
      : undefined;
    return {
      id: row.id,
      role: row.role === 'assistant' ? 'assistant' : 'user',
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      actions: actions?.length ? actions : undefined,
      isError: row.isError || undefined,
    };
  });
}

export async function saveAgentMessage(chatId: string, message: FinanceChatMessage) {
  await getDb()
    .insert(financeAgentMessages)
    .values({
      id: message.id,
      chatId,
      role: message.role,
      content: message.content,
      actions: message.actions ?? [],
      isError: Boolean(message.isError),
      createdAt: new Date(message.createdAt),
    })
    .onConflictDoUpdate({
      target: financeAgentMessages.id,
      set: {
        content: message.content,
        actions: message.actions ?? [],
        isError: Boolean(message.isError),
      },
    });

  const conversation = await getConversation(chatId);
  const nextTitle =
    conversation?.title === 'New chat' && message.role === 'user'
      ? message.content.replace(/\s+/g, ' ').slice(0, 48)
      : undefined;
  await touchConversation(chatId, nextTitle);
}

export async function clearAgentMessages(chatId: string) {
  await getDb().delete(financeAgentMessages).where(eq(financeAgentMessages.chatId, chatId));
  await touchConversation(chatId);
}

export async function syncActionInMessages(actionId: string, patch: Partial<PendingAgentAction>) {
  const rows = await getDb().select().from(financeAgentMessages);
  for (const row of rows) {
    if (!Array.isArray(row.actions) || row.actions.length === 0) continue;
    let changed = false;
    const actions = row.actions.map((item) => {
      if (typeof item !== 'object' || item === null || !('id' in item) || item.id !== actionId) {
        return item;
      }
      changed = true;
      return { ...item, ...patch };
    });
    if (!changed) continue;
    await getDb().update(financeAgentMessages).set({ actions }).where(eq(financeAgentMessages.id, row.id));
  }
}

function hydrateStoredAction(
  item: unknown,
  liveById: Map<string, typeof financeAgentActions.$inferSelect>
): PendingAgentAction {
  const stored = item as PendingAgentAction;
  const live = stored?.id ? liveById.get(stored.id) : undefined;
  if (!live) return stored;
  return {
    ...stored,
    actionType: live.actionType as PendingAgentAction['actionType'],
    preview: live.preview,
    status: live.status,
    expiresAt: live.expiresAt.toISOString(),
    error: live.error,
  };
}

export function fingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

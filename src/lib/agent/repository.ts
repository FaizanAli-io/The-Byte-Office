import { createHash } from 'crypto';
import { idEq } from '@/lib/db/ids';
import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { agentConversations, financeAgentActions, financeAgentMessages, financeAgentToolLogs } from '@/lib/db/schema';
import {
  parseAgentWorkspace,
  type ActionPreview,
  type AgentActionPayload,
  type AgentActionType,
  type AgentChatMessage,
  type AgentConversation,
  type AgentWorkspace,
  type PendingAgentAction,
} from './types';

const ACTION_TTL_MS = 15 * 60 * 1000;

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
  return (await getDb().select().from(financeAgentActions).where(idEq(financeAgentActions.id, id)).limit(1))[0] ?? null;
}

/** Status transitions are all "update if the row is still in the expected state". */
async function setActionStatus(
  id: string,
  status: 'executing' | 'cancelled' | 'completed' | 'failed',
  options: { from?: 'pending' | 'executing'; notExpired?: boolean; error?: string | null; executed?: boolean } = {}
) {
  const conditions = [idEq(financeAgentActions.id, id)];
  if (options.from) conditions.push(eq(financeAgentActions.status, options.from));
  if (options.notExpired) conditions.push(gt(financeAgentActions.expiresAt, new Date()));

  const [action] = await getDb()
    .update(financeAgentActions)
    .set({
      status,
      ...(options.error !== undefined ? { error: options.error } : {}),
      ...(options.executed ? { executedAt: new Date() } : {}),
    })
    .where(and(...conditions))
    .returning();
  return action ?? null;
}

export function claimAgentAction(id: string) {
  return setActionStatus(id, 'executing', { from: 'pending', notExpired: true, error: null });
}

export function cancelAgentAction(id: string) {
  return setActionStatus(id, 'cancelled', { from: 'pending' });
}

export function completeAgentAction(id: string) {
  return setActionStatus(id, 'completed', { from: 'executing', error: null, executed: true });
}

export function failAgentAction(id: string, error: string) {
  return setActionStatus(id, 'failed', { error: error.slice(0, 500) });
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
  const [row] = await getDb().select().from(agentConversations).where(idEq(agentConversations.id, id)).limit(1);
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
    .where(idEq(agentConversations.id, id))
    .returning();
  return row ? toConversation(row) : null;
}

export async function deleteConversation(id: string) {
  const deleted = await getDb()
    .delete(agentConversations)
    .where(idEq(agentConversations.id, id))
    .returning({ id: agentConversations.id });
  return deleted.length > 0;
}

async function touchConversation(id: string, title?: string) {
  await getDb()
    .update(agentConversations)
    .set({
      updatedAt: new Date(),
      ...(title ? { title } : {}),
    })
    .where(idEq(agentConversations.id, id));
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

  return rows.map((row): AgentChatMessage => {
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

export async function saveAgentMessage(chatId: string, message: AgentChatMessage) {
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

import {
  clearAgentMessages,
  getConversation,
  listAgentMessages,
  saveAgentMessage,
} from '@/lib/agent/repository';
import type { AgentChatMessage } from '@/lib/agent/types';
import { ApiError, apiRoute, found, jsonBody, searchParam } from '@/lib/api';

async function requireChat(id: string | null | undefined) {
  if (!id) throw new ApiError('Chat not found', 404);
  found(await getConversation(id), 'Chat not found');
  return id;
}

export const GET = apiRoute('GET /api/finance-agent/messages', 'Failed to load conversation', async (req: Request) => ({
  messages: await listAgentMessages(await requireChat(searchParam(req, 'chatId'))),
}));

export const POST = apiRoute('POST /api/finance-agent/messages', 'Failed to save message', async (req: Request) => {
  const body = await jsonBody<{ chatId?: unknown; message?: unknown }>(req);
  const chatId = await requireChat(typeof body.chatId === 'string' ? body.chatId : null);
  const message = parseMessage(body.message);
  await saveAgentMessage(chatId, message);
  return { message };
});

export const DELETE = apiRoute(
  'DELETE /api/finance-agent/messages',
  'Failed to clear conversation',
  async (req: Request) => {
    await clearAgentMessages(await requireChat(searchParam(req, 'chatId')));
    return { ok: true };
  }
);

function parseMessage(value: unknown): AgentChatMessage {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    !('role' in value) ||
    !('content' in value) ||
    !('createdAt' in value) ||
    typeof value.id !== 'string' ||
    (value.role !== 'user' && value.role !== 'assistant') ||
    typeof value.content !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    throw new ApiError('Invalid chat message');
  }
  return {
    id: value.id,
    role: value.role,
    content: value.content,
    createdAt: value.createdAt,
    actions: 'actions' in value && Array.isArray(value.actions) ? value.actions : undefined,
    isError: 'isError' in value && value.isError === true ? true : undefined,
  };
}

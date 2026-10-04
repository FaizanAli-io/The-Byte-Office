import { clearAgentMessages, getConversation, listAgentMessages } from '@/lib/agent/repository';
import { ApiError, apiRoute, found, searchParam } from '@/lib/api';

async function requireChat(id: string | null) {
  if (!id) throw new ApiError('Chat not found', 404);
  found(await getConversation(id), 'Chat not found');
  return id;
}

export const GET = apiRoute('GET /api/finance-agent/messages', 'Failed to load conversation', async (req: Request) => ({
  messages: await listAgentMessages(await requireChat(searchParam(req, 'chatId'))),
}));

export const DELETE = apiRoute(
  'DELETE /api/finance-agent/messages',
  'Failed to clear conversation',
  async (req: Request) => {
    await clearAgentMessages(await requireChat(searchParam(req, 'chatId')));
    return { ok: true };
  }
);

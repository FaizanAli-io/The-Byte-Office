import { createConversation, listConversations } from '@/lib/finance-agent/repository';
import { parseAgentWorkspace } from '@/lib/finance-agent/types';
import { apiRoute, created, optionalJsonBody, searchParam } from '@/lib/api';

export const GET = apiRoute('GET /api/agent/chats', 'Failed to load chats', async (req: Request) => {
  const raw = searchParam(req, 'workspace');
  const workspace = raw === 'finance' || raw === 'personal' ? raw : undefined;
  return { chats: await listConversations(workspace) };
});

export const POST = apiRoute('POST /api/agent/chats', 'Failed to create chat', async (req: Request) => {
  const body = await optionalJsonBody<{ title?: unknown; workspace?: unknown }>(req);
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 80) : 'New chat';
  return created({ chat: await createConversation(title, parseAgentWorkspace(body.workspace)) });
});

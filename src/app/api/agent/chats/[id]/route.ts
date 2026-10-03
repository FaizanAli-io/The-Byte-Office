import { deleteConversation, getConversation, renameConversation } from '@/lib/agent/repository';
import { ApiError, apiRoute, found, jsonBody } from '@/lib/api';

type Context = { params: Promise<{ id: string }> };

export const GET = apiRoute(
  'GET /api/agent/chats/[id]',
  'Failed to load chat',
  async (_req: Request, ctx: Context) => ({
    chat: found(await getConversation((await ctx.params).id), 'Chat not found'),
  })
);

export const PATCH = apiRoute(
  'PATCH /api/agent/chats/[id]',
  'Failed to rename chat',
  async (req: Request, ctx: Context) => {
    const { title } = await jsonBody<{ title?: unknown }>(req);
    if (typeof title !== 'string' || !title.trim()) throw new ApiError('Title is required');
    return {
      chat: found(await renameConversation((await ctx.params).id, title.trim().slice(0, 80)), 'Chat not found'),
    };
  }
);

export const DELETE = apiRoute(
  'DELETE /api/agent/chats/[id]',
  'Failed to delete chat',
  async (_req: Request, ctx: Context) => {
    found((await deleteConversation((await ctx.params).id)) || null, 'Chat not found');
    return { success: true };
  }
);

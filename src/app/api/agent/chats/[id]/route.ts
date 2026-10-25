import { deleteConversation } from '@/lib/agent/repository';
import { apiRoute, found, type IdContext } from '@/lib/api';

export const DELETE = apiRoute(
  'DELETE /api/agent/chats/[id]',
  'Failed to delete chat',
  async (_req: Request, ctx: IdContext) => {
    found((await deleteConversation((await ctx.params).id)) || null, 'Chat not found');
    return { success: true };
  }
);

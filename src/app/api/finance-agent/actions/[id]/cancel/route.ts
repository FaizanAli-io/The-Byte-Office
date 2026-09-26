import { cancelPendingAgentAction } from '@/lib/finance-agent/actions';
import { apiRoute } from '@/lib/api';

export const POST = apiRoute(
  'POST /api/finance-agent/actions/[id]/cancel',
  'Could not cancel action',
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => ({
    action: await cancelPendingAgentAction((await ctx.params).id),
  })
);

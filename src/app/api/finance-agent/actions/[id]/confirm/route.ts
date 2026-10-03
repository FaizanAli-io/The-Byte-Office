import { executeAgentAction } from '@/lib/agent/actions';
import { apiRoute, optionalJsonBody } from '@/lib/api';

export const POST = apiRoute(
  'POST /api/finance-agent/actions/[id]/confirm',
  'Could not confirm action',
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { entry } = await optionalJsonBody<{ entry?: unknown }>(req);
    return executeAgentAction((await ctx.params).id, entry);
  }
);

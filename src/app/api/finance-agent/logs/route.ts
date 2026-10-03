import { listAgentToolLogs } from '@/lib/agent/repository';
import { apiRoute, searchParam } from '@/lib/api';

export const GET = apiRoute('GET /api/finance-agent/logs', 'Failed to load assistant logs', async (req: Request) => ({
  logs: await listAgentToolLogs(Number(searchParam(req, 'limit') || 200)),
}));

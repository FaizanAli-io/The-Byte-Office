import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import { executeFinanceTool } from '@/lib/finance-agent/tools';
import { jsonResource } from '@/mcp/result';

export function registerFinanceResources(server: McpServer) {
  server.registerResource(
    'portfolio',
    'finance://portfolio',
    {
      title: 'Live portfolio',
      description: 'Current holdings, stable item IDs, and PKR total',
      mimeType: 'application/json',
    },
    async (uri) => jsonResource(uri.href, await readFinance('portfolio_get'))
  );

  server.registerResource(
    'ledgers',
    new ResourceTemplate('finance://ledgers/{month}', {
      list: async () => {
        const summaries = (await readFinance('ledgers_list')) as Array<{ month: string; status: string }>;
        return {
          resources: summaries.map((ledger) => ({
            uri: `finance://ledgers/${ledger.month}`,
            name: `${ledger.month} (${ledger.status})`,
            mimeType: 'application/json',
          })),
        };
      },
    }),
    {
      title: 'Monthly ledger',
      description: 'One monthly ledger, including entry serials',
      mimeType: 'application/json',
    },
    async (uri, { month }) => jsonResource(uri.href, await readFinance('ledger_get', { month }))
  );

  server.registerResource(
    'snapshots',
    new ResourceTemplate('finance://snapshots/{id}', {
      list: async () => {
        const snapshots = (await readFinance('snapshots_list')) as Array<{ id: string; timestamp: Date | string }>;
        return {
          resources: snapshots.map((snapshot) => ({
            uri: `finance://snapshots/${snapshot.id}`,
            name: snapshot.timestamp instanceof Date ? snapshot.timestamp.toISOString() : snapshot.timestamp,
            mimeType: 'application/json',
          })),
        };
      },
    }),
    {
      title: 'Portfolio snapshot',
      description: 'One saved portfolio snapshot',
      mimeType: 'application/json',
    },
    async (uri, { id }) => jsonResource(uri.href, await readFinance('snapshot_get', { id }))
  );
}

async function readFinance(name: string, args: unknown = {}) {
  const { output } = await executeFinanceTool(name, args);
  return output;
}

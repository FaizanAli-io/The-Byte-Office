import type { McpServer } from '@modelcontextprotocol/server';
import { registerFinanceResources } from './resources';
import { registerFinanceTools } from './tools';

export function registerFinanceModule(server: McpServer) {
  registerFinanceTools(server);
  registerFinanceResources(server);
}

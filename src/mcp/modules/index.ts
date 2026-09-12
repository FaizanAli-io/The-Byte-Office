import type { McpServer } from '@modelcontextprotocol/server';
import { registerFinanceModule } from './finance';

export function registerModules(server: McpServer) {
  registerFinanceModule(server);
}

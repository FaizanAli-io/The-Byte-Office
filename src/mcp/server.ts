import { McpServer } from '@modelcontextprotocol/server';
import { registerModules } from './modules';

export const MCP_SERVER_NAME = 'the-byte-office';
export const MCP_SERVER_VERSION = '0.1.0';

const INSTRUCTIONS = [
  'Private tools for The Byte Office.',
  'This server currently exposes the finance module: live portfolio, snapshots, and monthly ledgers.',
  'Read before mutating. Never invent IDs or balances.',
  'Use ledger entry serials such as 0001, not UUIDs.',
  'Finalized ledgers are read-only.',
  'Write tools apply immediately after the host confirms the tool call.',
].join(' ');

export function createMcpServer() {
  const server = new McpServer(
    {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
    { instructions: INSTRUCTIONS }
  );

  registerModules(server);
  return server;
}

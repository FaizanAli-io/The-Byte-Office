import { McpServer } from '@modelcontextprotocol/server';
import { registerResources } from './resources';
import { registerTools } from './tools';

export const MCP_SERVER_NAME = 'the-byte-office';
export const MCP_SERVER_VERSION = '0.1.0';

const INSTRUCTIONS = [
  'Private tools for The Byte Office.',
  'Three modules: finance (portfolio, snapshots, monthly ledgers), personal (missed prayers, health readings), and tbo (company information and the contact inbox).',
  'Only the tools the granted scopes allow are listed, so what you can see is what you may do.',
  'Read before mutating. Never invent IDs or balances.',
  "Every amount is in its account's own currency and major unit (rupees, dollars, pounds), never paisa or cents.",
  'Exchange rates are never typed: exchange_rates_get shows the live table every PKR conversion uses, and exchange_rates_refresh fetches it now.',
  'A new transfer takes amount (sent) and destinationAmount (received); any difference is recorded as its own Exchange cost, Exchange gain or Transfer fees entry.',
  'Use ledger entry serials such as 0001, not UUIDs.',
  'Finalized ledgers are read-only.',
  'Write tools apply immediately after the host confirms the tool call. tbo_send_inquiry really does send an email.',
].join(' ');

export function createMcpServer(scopes: string[], clientId?: string) {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION }, { instructions: INSTRUCTIONS });

  registerTools(server, scopes, clientId);
  registerResources(server, scopes);
  return server;
}

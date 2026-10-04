import type { McpServer } from '@modelcontextprotocol/server';
import { mcpToolRegistry, type AgentToolDefinition } from '@/lib/agent/registry';
import { scopeForTool } from '@/lib/oauth/tokens';
import { invokeAgentTool } from './invoke';
import { runTool } from './result';

function annotationsFor(tool: AgentToolDefinition) {
  return {
    readOnlyHint: !tool.write,
    destructiveHint: Boolean(tool.destructive),
    idempotentHint: !tool.write || Boolean(tool.destructive) || tool.name.endsWith('_update'),
    openWorldHint: false,
  } as const;
}

export function registerTools(server: McpServer, scopes: string[]) {
  for (const tool of mcpToolRegistry) {
    if (!scopes.includes(scopeForTool(tool))) continue;

    const config = {
      title: tool.title,
      description: tool.description,
      annotations: annotationsFor(tool),
    };
    const invoke = (args: unknown) => runTool(() => invokeAgentTool(tool.name, args ?? {}));

    // Without an inputSchema the callback receives `extra` as its first argument.
    if (Object.keys(tool.schema.shape).length === 0) {
      server.registerTool(tool.name, config, async () => invoke({}));
      continue;
    }

    server.registerTool(tool.name, { ...config, inputSchema: tool.schema.shape }, async (args) => invoke(args));
  }
}

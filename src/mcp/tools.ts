import type { McpServer } from '@modelcontextprotocol/server';
import { mcpToolRegistry, type AgentToolDefinition } from '@/lib/agent/registry';
import { scopeForTool } from '@/lib/oauth/tokens';
import { invokeAgentTool } from './invoke';
import { runTool } from './result';

function annotationsFor(tool: AgentToolDefinition) {
  return {
    readOnlyHint: !tool.write,
    destructiveHint: Boolean(tool.destructive),
    // Reads and removals are repeatable; creating and editing are not.
    idempotentHint: !tool.write || Boolean(tool.destructive) || tool.name.endsWith('_update'),
    openWorldHint: false,
  } as const;
}

/**
 * Registers only the tools the token's scopes allow, so a client sees exactly
 * what it can use. Refusing the call afterwards would work, but a tool the
 * model cannot use is a tool it should not be shown.
 */
export function registerTools(server: McpServer, scopes: string[]) {
  for (const tool of mcpToolRegistry) {
    if (!scopes.includes(scopeForTool(tool))) continue;

    const config = {
      title: tool.title,
      description: tool.description,
      annotations: annotationsFor(tool),
    };
    const invoke = (args: unknown) => runTool(() => invokeAgentTool(tool.name, args ?? {}));

    // A tool registered without an inputSchema receives the request "extra" as
    // its first callback argument rather than parsed arguments, so the two
    // cases have to be registered separately.
    if (Object.keys(tool.schema.shape).length === 0) {
      server.registerTool(tool.name, config, async () => invoke({}));
      continue;
    }

    server.registerTool(tool.name, { ...config, inputSchema: tool.schema.shape }, async (args) => invoke(args));
  }
}

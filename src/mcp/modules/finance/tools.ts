import type { McpServer } from '@modelcontextprotocol/server';
import { applyFinanceAction, type FinanceWriteAction } from '@/lib/finance-agent/actions';
import { executeFinanceTool } from '@/lib/finance-agent/tools';
import { mcpToolRegistry, type AgentToolDefinition } from '@/lib/agent/registry';
import { runTool } from '@/mcp/result';

function annotationsFor(tool: AgentToolDefinition) {
  return {
    readOnlyHint: !tool.write,
    destructiveHint: Boolean(tool.destructive),
    // Reads and removals are repeatable; creating and editing are not.
    idempotentHint: !tool.write || Boolean(tool.destructive) || tool.name.endsWith('_update'),
    openWorldHint: false,
  } as const;
}

function invoke(tool: AgentToolDefinition, args: unknown) {
  return runTool(async () => {
    if (tool.write) return applyFinanceAction(tool.name as FinanceWriteAction, args ?? {});
    const { output } = await executeFinanceTool(tool.name, args ?? {});
    return output;
  });
}

export function registerFinanceTools(server: McpServer) {
  for (const tool of mcpToolRegistry) {
    const config = {
      title: tool.title,
      description: tool.description,
      annotations: annotationsFor(tool),
    };

    // A tool registered without an inputSchema receives the request "extra" as
    // its first callback argument rather than parsed arguments, so the two
    // cases have to be registered separately.
    if (Object.keys(tool.schema.shape).length === 0) {
      server.registerTool(tool.name, config, async () => invoke(tool, {}));
      continue;
    }

    server.registerTool(tool.name, { ...config, inputSchema: tool.schema.shape }, async (args) => invoke(tool, args));
  }
}

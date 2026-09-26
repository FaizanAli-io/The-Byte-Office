import { httpMethodFor, mcpToolByName, mcpToolRegistry, type AgentToolDefinition } from '@/lib/agent/registry';

export type ToolHttpMethod = 'get' | 'post';
export type FinanceToolDefinition = AgentToolDefinition;

export const financeToolCatalog = mcpToolRegistry;
export const financeToolByName = mcpToolByName;

export function inputSchemaForTool(tool: AgentToolDefinition) {
  return tool.schema;
}

export { httpMethodFor };

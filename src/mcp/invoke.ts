import { executeAgentAction } from '@/lib/agent/actions';
import { executeAgentTool } from '@/lib/agent/runtime';
import { mcpToolByName } from '@/lib/agent/registry';

export async function invokeAgentTool(name: string, args: unknown = {}) {
  const tool = mcpToolByName.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);

  const parsed = tool.schema.parse(args);
  const { output, pendingAction } = await executeAgentTool(name, parsed);
  if (!pendingAction) return output;

  const { result } = await executeAgentAction(pendingAction.id, parsed);
  return result;
}

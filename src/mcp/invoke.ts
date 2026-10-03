import { executeAgentAction } from '@/lib/agent/actions';
import { executeAgentTool } from '@/lib/agent/runtime';
import { mcpToolByName } from '@/lib/agent/registry';

/**
 * Runs a tool for the MCP surface, where a write applies immediately.
 *
 * The chat surface and this one share `executeAgentTool`: a read returns its
 * output, and a write returns a pending action for a person to confirm. The
 * only difference here is that there is no person, so the pending action is
 * executed in the same breath. That keeps one execution path across all three
 * modules rather than a parallel one per surface.
 */
export async function invokeAgentTool(name: string, args: unknown = {}) {
  const tool = mcpToolByName.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);

  const parsed = tool.schema.parse(args);
  const { output, pendingAction } = await executeAgentTool(name, parsed);
  if (!pendingAction) return output;

  // The arguments are passed again so a ledger entry proposal, which is
  // created as an empty form for the chat UI, is filled from the call.
  const { result } = await executeAgentAction(pendingAction.id, parsed);
  return result;
}

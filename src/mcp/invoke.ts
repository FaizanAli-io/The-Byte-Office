import { randomUUID } from 'crypto';
import { proposeAgentAction, runProposal } from '@/lib/agent/actions';
import { logAgentToolCall } from '@/lib/agent/repository';
import { readAgentTool } from '@/lib/agent/runtime';
import { mcpToolByName, parseToolArgs } from '@/lib/agent/registry';
import type { AgentActionType } from '@/lib/agent/types';
import { getClient } from '@/lib/oauth/store';

export async function invokeAgentTool(name: string, args: unknown = {}, clientId?: string) {
  const tool = mcpToolByName.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);

  const startedAt = Date.now();
  const log = async (outcome: { result?: unknown; error?: string }) => {
    const client = clientId ? await getClient(clientId) : null;
    await logAgentToolCall({
      requestId: randomUUID(),
      type: 'external',
      model: client?.clientName ?? clientId ?? 'unknown client',
      toolCallId: randomUUID(),
      toolName: name,
      arguments: args,
      durationMs: Date.now() - startedAt,
      ...outcome,
    }).catch((cause) => console.error('Could not persist MCP tool log:', cause));
  };

  try {
    const parsed = parseToolArgs(name, args);
    const result = tool.write
      ? await runProposal(await proposeAgentAction(name as AgentActionType, parsed), parsed)
      : await readAgentTool(name, parsed);
    await log({ result });
    return result;
  } catch (error) {
    await log({ error: error instanceof Error ? error.message : 'Tool execution failed' });
    throw error;
  }
}

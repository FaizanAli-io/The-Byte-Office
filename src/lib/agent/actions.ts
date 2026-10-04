import { ApiError } from '@/lib/api';
import { toPublicAction } from '@/lib/agent/action-utils';
import { executePersonalPayload, proposePersonalAction } from '@/lib/agent/modules/personal';
import { executeTboInquiry, proposeTboInquiry } from '@/lib/agent/modules/tbo';
import { executeFinancePayload, proposeFinanceAction } from '@/lib/agent/modules/finance/actions';
import { agentToolByName } from './registry';
import {
  cancelAgentAction,
  claimAgentAction,
  completeAgentAction,
  failAgentAction,
  getAgentAction,
} from './repository';
import type { AgentActionPayload, AgentActionType, AgentProposal, PersonalActionType } from './types';

export async function executeAgentAction(id: string, entryOverride?: unknown) {
  const action = await claimAgentAction(id);
  if (!action) {
    const existing = await getAgentAction(id);
    if (!existing) throw new ApiError('Action not found', 404);
    if (existing.status === 'pending' && existing.expiresAt <= new Date()) {
      await failAgentAction(id, 'Action expired before confirmation');
      throw new ApiError('This confirmation has expired', 409);
    }
    throw new ApiError(`This action is already ${existing.status}`, 409);
  }

  try {
    const result = await executePayload(
      action.payload as unknown as AgentActionPayload,
      action.sourceFingerprint,
      entryOverride
    );
    const completed = await completeAgentAction(action.id);
    if (!completed) throw new Error('Could not mark the action as completed');
    return { action: toPublicAction(completed), result };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Action execution failed';
    await failAgentAction(action.id, message);
    throw cause instanceof ApiError ? cause : new ApiError(message, 409);
  }
}

export async function cancelPendingAgentAction(id: string) {
  const cancelled = await cancelAgentAction(id);
  if (cancelled) return toPublicAction(cancelled);
  const existing = await getAgentAction(id);
  if (!existing) throw new ApiError('Action not found', 404);
  throw new ApiError(`This action is already ${existing.status}`, 409);
}

async function executePayload(payload: AgentActionPayload, sourceFingerprint: string | null, entryOverride: unknown) {
  switch (payload.actionType) {
    case 'prayer_set':
    case 'health_add':
    case 'health_update':
    case 'health_remove':
    case 'health_metric_add':
    case 'health_metric_update':
    case 'health_metric_remove':
      return executePersonalPayload(payload, sourceFingerprint);
    case 'tbo_send_inquiry':
      return executeTboInquiry(payload);
    default:
      return executeFinancePayload(payload, sourceFingerprint, entryOverride);
  }
}

export async function proposeAgentAction(name: AgentActionType, args: Record<string, unknown>): Promise<AgentProposal> {
  switch (agentToolByName.get(name)?.module) {
    case 'personal':
      return proposePersonalAction(name as PersonalActionType, args);
    case 'tbo':
      return proposeTboInquiry(args);
    default:
      return proposeFinanceAction(name, args);
  }
}

export function runProposal(proposal: AgentProposal, entryOverride?: unknown) {
  return executePayload(proposal.payload, proposal.sourceFingerprint ?? null, entryOverride);
}

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

type PayloadOf<F extends (payload: never, ...rest: never[]) => unknown> = Parameters<F>[0];

// Routed by the tool's module, as proposals are.
async function executePayload(payload: AgentActionPayload, sourceFingerprint: string | null, entryOverride: unknown) {
  switch (agentToolByName.get(payload.actionType)?.module) {
    case 'personal':
      return executePersonalPayload(payload as PayloadOf<typeof executePersonalPayload>, sourceFingerprint);
    case 'tbo':
      return executeTboInquiry(payload as PayloadOf<typeof executeTboInquiry>);
    default:
      return executeFinancePayload(
        payload as PayloadOf<typeof executeFinancePayload>,
        sourceFingerprint,
        entryOverride
      );
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

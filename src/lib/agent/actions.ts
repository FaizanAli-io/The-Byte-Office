import { AgentActionError, toPublicAction } from '@/lib/agent/action-utils';
import { executePersonalPayload } from '@/lib/agent/modules/personal';
import { executeTboInquiry } from '@/lib/agent/modules/tbo-actions';
import { executeFinancePayload } from '@/lib/finance-agent/actions';
import {
  cancelAgentAction,
  claimAgentAction,
  completeAgentAction,
  failAgentAction,
  getAgentAction,
  syncActionInMessages,
} from './repository';
import type { AgentActionPayload } from './types';

export async function executeAgentAction(id: string, entryOverride?: unknown) {
  const action = await claimAgentAction(id);
  if (!action) {
    const existing = await getAgentAction(id);
    if (!existing) throw new AgentActionError('Action not found', 404);
    if (existing.status === 'pending' && existing.expiresAt <= new Date()) {
      await failAgentAction(id, 'Action expired before confirmation');
      throw new AgentActionError('This confirmation has expired', 409);
    }
    throw new AgentActionError(`This action is already ${existing.status}`, 409);
  }

  try {
    const result = await executePayload(
      action.payload as unknown as AgentActionPayload,
      action.sourceFingerprint,
      entryOverride
    );
    const completed = await completeAgentAction(action.id);
    if (!completed) {
      throw new Error('Could not mark the action as completed');
    }
    const publicAction = toPublicAction(completed);
    await syncActionInMessages(action.id, publicAction);
    return { action: publicAction, result };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Action execution failed';
    await failAgentAction(action.id, message);
    await syncActionInMessages(id, { status: 'failed', error: message });
    throw cause instanceof AgentActionError ? cause : new AgentActionError(message, 409);
  }
}

export async function cancelPendingAgentAction(id: string) {
  const cancelled = await cancelAgentAction(id);
  if (cancelled) {
    const publicAction = toPublicAction(cancelled);
    await syncActionInMessages(id, publicAction);
    return publicAction;
  }

  const existing = await getAgentAction(id);
  if (!existing) throw new AgentActionError('Action not found', 404);
  throw new AgentActionError(`This action is already ${existing.status}`, 409);
}

async function executePayload(payload: AgentActionPayload, sourceFingerprint: string | null, entryOverride: unknown) {
  switch (payload.actionType) {
    case 'prayer_set':
    case 'health_add':
    case 'health_update':
    case 'health_remove':
      return executePersonalPayload(payload, sourceFingerprint);
    case 'tbo_send_inquiry':
      return executeTboInquiry(payload);
    default:
      return executeFinancePayload(payload, sourceFingerprint, entryOverride);
  }
}
